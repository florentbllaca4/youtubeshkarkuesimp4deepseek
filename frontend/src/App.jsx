import React, { useState, useEffect } from 'react';
import { ReactComponent as DownloadIcon } from './assets/download-icon.svg';
import { ReactComponent as YouTubeIcon } from './assets/youtube-icon.svg';
import './index.css';

const API_BASE_URL = 'https://[YOUR-BACKEND-APP].fly.dev';

function App() {
  const [url, setUrl] = useState('');
  const [downloadId, setDownloadId] = useState(null);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState('0 KiB/s');
  const [eta, setEta] = useState('00:00');
  const [status, setStatus] = useState('waiting');
  const [error, setError] = useState(null);
  const [downloadLink, setDownloadLink] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasDownloaded, setHasDownloaded] = useState(false);

  const resetForm = () => {
    setUrl('');
    setDownloadId(null);
    setProgress(0);
    setSpeed('0 KiB/s');
    setEta('00:00');
    setStatus('waiting');
    setError(null);
    setDownloadLink(null);
    setIsLoading(false);
    setHasDownloaded(false);
  };

  const handleDownloadClick = () => {
    setHasDownloaded(true);
  };

  useEffect(() => {
    if (hasDownloaded) {
      const timer = setTimeout(() => {
        resetForm();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [hasDownloaded]);

  const checkProgress = async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/progress/${id}`);
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        setIsLoading(false);
        return;
      }
      
      setProgress(data.progress);
      setSpeed(data.speed);
      setEta(data.eta);
      setStatus(data.status);
      
      if (data.status === 'ready' && data.filename) {
        setDownloadLink(data.filename);
        setIsLoading(false);
      } else if (data.status !== 'ready') {
        setTimeout(() => checkProgress(id), 1000);
      }
    } catch (err) {
      setError('Failed to check download progress');
      setIsLoading(false);
    }
  };

  const startDownload = async (audioOnly = false) => {
    if (!url) {
      setError('Please enter a YouTube URL');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setDownloadLink(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, audio_only: audioOnly }),
      });
      
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        setIsLoading(false);
        return;
      }
      
      setDownloadId(data.download_id);
      checkProgress(data.download_id);
    } catch (err) {
      setError('Failed to start download');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <YouTubeIcon className="w-20 h-20 mx-auto text-red-600 mb-4" />
            <h1 className="text-4xl font-bold mb-2">YouTube Downloader</h1>
            <p className="text-gray-400">Download videos as MP4 (h264) or audio as MP3</p>
          </div>
          
          <div className="bg-gray-800 rounded-xl shadow-2xl p-6 mb-8">
            <div className="flex items-center mb-4">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste YouTube URL here..."
                className="flex-1 bg-gray-700 rounded-l-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <button
                onClick={() => setUrl('')}
                className="bg-gray-600 hover:bg-gray-500 px-4 py-3 transition-colors"
              >
                Clear
              </button>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => startDownload(false)}
                disabled={isLoading}
                className={`flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-all ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <DownloadIcon className="w-5 h-5" />
                Download Video (MP4)
              </button>
              
              <button
                onClick={() => startDownload(true)}
                disabled={isLoading}
                className={`flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-all ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <DownloadIcon className="w-5 h-5" />
                Download Audio (MP3)
              </button>
            </div>
          </div>
          
          {error && (
            <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-8">
              <p className="text-red-200">{error}</p>
            </div>
          )}
          
          {(isLoading || downloadLink) && (
            <div className="bg-gray-800 rounded-xl shadow-2xl p-6 mb-8 transition-all">
              <h2 className="text-xl font-semibold mb-4">
                {status === 'waiting' && 'Preparing download...'}
                {status === 'downloading' && 'Downloading...'}
                {status === 'converting' && 'Converting...'}
                {status === 'ready' && 'Download ready!'}
              </h2>
              
              {status !== 'ready' && (
                <div className="space-y-4">
                  <div className="w-full bg-gray-700 rounded-full h-2.5">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-purple-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                      <p className="text-gray-400">Progress</p>
                      <p className="font-mono">{progress.toFixed(1)}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-400">Speed</p>
                      <p className="font-mono">{speed}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-400">Time remaining</p>
                      <p className="font-mono">{eta}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {downloadLink && (
                <div className="text-center mt-6">
                  <a
                    href={`${API_BASE_URL}/api/download/${downloadLink}`}
                    download
                    onClick={handleDownloadClick}
                    className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                  >
                    <DownloadIcon className="w-5 h-5" />
                    Click to download {downloadLink.endsWith('.mp3') ? 'audio' : 'video'}
                  </a>
                  <p className="text-gray-400 mt-2 text-sm">
                    File will be automatically deleted after 15 minutes
                  </p>
                </div>
              )}
            </div>
          )}
          
          {hasDownloaded && (
            <div className="text-center mt-4">
              <button
                onClick={resetForm}
                className="text-blue-400 hover:text-blue-300 underline"
              >
                Download another video
              </button>
            </div>
          )}
          
          <div className="text-center text-gray-500 text-sm">
            <p>Note: This tool is for personal use only. Please respect copyright laws.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;