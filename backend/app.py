import os
import time
import threading
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
import yt_dlp
import ffmpeg

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

app.config['UPLOAD_FOLDER'] = os.environ.get('UPLOAD_FOLDER', 'downloads')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
app.config['FILE_LIFETIME'] = 900

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

class DownloadProgress:
    def __init__(self):
        self.progress = 0
        self.speed = "0 KiB/s"
        self.eta = "00:00"
        self.status = "waiting"
        self.filename = None

    def progress_hook(self, d):
        if d['status'] == 'downloading':
            self.status = "downloading"
            self.progress = float(d['_percent_str'].strip('%'))
            self.speed = d['_speed_str'].strip()
            self.eta = d['_eta_str']
        elif d['status'] == 'finished':
            self.status = "converting"
            self.progress = 100

progress_data = {}

def generate_id():
    return str(int(time.time() * 1000))[-8:]

def download_video(url, audio_only=False):
    download_id = generate_id()
    progress_data[download_id] = DownloadProgress()
    
    ydl_opts = {
        'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        'outtmpl': os.path.join(app.config['UPLOAD_FOLDER'], f'%(id)s.%(ext)s'),
        'progress_hooks': [progress_data[download_id].progress_hook],
        'quiet': True,
    }
    
    if audio_only:
        ydl_opts.update({
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'extractaudio': True,
        })
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)
            
            if audio_only:
                filename = filename.rsplit('.', 1)[0] + '.mp3'
            else:
                probe = ffmpeg.probe(filename)
                video_stream = next((s for s in probe['streams'] if s['codec_type'] == 'video'), None)
                
                if video_stream and video_stream['codec_name'] != 'h264':
                    new_filename = filename.rsplit('.', 1)[0] + '_h264.mp4'
                    (
                        ffmpeg.input(filename)
                        .output(new_filename, vcodec='libx264', acodec='copy')
                        .run(quiet=True)
                    )
                    os.remove(filename)
                    filename = new_filename
            
            progress_data[download_id].status = "ready"
            progress_data[download_id].filename = os.path.basename(filename)
            return download_id, None
    except Exception as e:
        return None, str(e)

@app.route('/api/download', methods=['POST'])
def start_download():
    data = request.json
    url = data.get('url')
    audio_only = data.get('audio_only', False)
    
    if not url:
        return jsonify({'error': 'URL is required'}), 400
    
    download_id, error = download_video(url, audio_only)
    if error:
        return jsonify({'error': error}), 500
    
    return jsonify({'download_id': download_id})

@app.route('/api/progress/<download_id>')
def get_progress(download_id):
    progress = progress_data.get(download_id)
    if not progress:
        return jsonify({'error': 'Invalid download ID'}), 404
    
    return jsonify({
        'progress': progress.progress,
        'speed': progress.speed,
        'eta': progress.eta,
        'status': progress.status,
        'filename': progress.filename
    })

@app.route('/api/download/<filename>')
def download_file(filename):
    if '..' in filename or filename.startswith('/'):
        return jsonify({'error': 'Invalid filename'}), 400
    
    return send_from_directory(
        app.config['UPLOAD_FOLDER'],
        filename,
        as_attachment=True
    )

def cleanup_files():
    while True:
        now = time.time()
        for filename in os.listdir(app.config['UPLOAD_FOLDER']):
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            if os.path.isfile(filepath):
                file_age = now - os.path.getmtime(filepath)
                if file_age > app.config['FILE_LIFETIME']:
                    try:
                        os.remove(filepath)
                    except Exception:
                        pass
        time.sleep(60)

if __name__ == '__main__':
    threading.Thread(target=cleanup_files, daemon=True).start()
    app.run(host='0.0.0.0', port=8000)