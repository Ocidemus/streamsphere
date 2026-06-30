import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Upload, Film, User, LogIn, LogOut, Search, 
  BarChart2, Clock, Eye, Video, Plus, Shield, CheckCircle, AlertCircle
} from 'lucide-react';

const BACKEND_HOST = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? `http://${window.location.hostname}:5001`
  : 'http://localhost:5001';

const API_BASE = `${BACKEND_HOST}/api`;

const getMediaUrl = (url) => {
  if (!url) return '';
  return url.startsWith('http') ? url : `${BACKEND_HOST}${url}`;
};

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('browse'); // 'browse', 'upload', 'dashboard', 'auth'
  
  // Auth state
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  
  // Videos state
  const [videos, setVideos] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVideo, setSelectedVideo] = useState(null);
  
  // Upload state
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Dashboard state
  const [analytics, setAnalytics] = useState(null);

  // Video Ref for watch time updates
  const videoRef = useRef(null);

  // Fetch current user if token exists
  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      fetchCurrentUser();
    } else {
      localStorage.removeItem('token');
      setCurrentUser(null);
    }
  }, [token]);

  // Fetch videos on mount/search
  useEffect(() => {
    fetchVideos();
  }, [searchQuery]);

  // Fetch analytics if logged in and tab changes to dashboard
  useEffect(() => {
    if (token && activeTab === 'dashboard') {
      fetchAnalytics();
    }
  }, [activeTab, token]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data);
      } else {
        setToken('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchVideos = async () => {
    try {
      const url = searchQuery ? `${API_BASE}/videos?search=${encodeURIComponent(searchQuery)}` : `${API_BASE}/videos`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setVideos(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`${API_BASE}/analytics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    const endpoint = isRegister ? 'register' : 'login';
    const payload = isRegister ? { username, email, password } : { email, password };

    try {
      const res = await fetch(`${API_BASE}/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.message || 'Authentication failed');
        return;
      }
      setToken(data.token);
      setActiveTab('browse');
      // Reset form
      setUsername('');
      setEmail('');
      setPassword('');
    } catch (err) {
      setAuthError('Server error, please try again.');
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Please select a video file.');
      return;
    }
    setUploading(true);
    setUploadError('');
    setUploadSuccess(false);

    const formData = new FormData();
    formData.append('title', uploadTitle);
    formData.append('description', uploadDesc);
    formData.append('video', uploadFile);

    try {
      const res = await fetch(`${API_BASE}/videos/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        setUploadSuccess(true);
        setUploadTitle('');
        setUploadDesc('');
        setUploadFile(null);
        fetchVideos();
      } else {
        const data = await res.json();
        setUploadError(data.message || 'Upload failed');
      }
    } catch (err) {
      setUploadError('Server error uploading video.');
    } finally {
      setUploading(false);
    }
  };

  const selectVideo = async (video) => {
    setSelectedVideo(video);
    // Call server to increment view count
    try {
      const res = await fetch(`${API_BASE}/videos/${video._id}`);
      if (res.ok) {
        const updatedVideo = await res.json();
        // Update local list with incremented view count
        setVideos(videos.map(v => v._id === video._id ? updatedVideo : v));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setSelectedVideo(null); setActiveTab('browse'); }}>
            <div className="p-2 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-lg shadow-lg">
              <Film className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              StreamSphere
            </span>
          </div>

          {/* Search bar when browsing */}
          {activeTab === 'browse' && !selectedVideo && (
            <div className="relative max-w-md w-full hidden md:block">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                <Search className="h-5 w-5" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search videos..."
                className="w-full pl-10 pr-4 py-2 bg-slate-800/60 border border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm placeholder-slate-400 transition-all"
              />
            </div>
          )}

          <nav className="flex items-center gap-4">
            <button 
              onClick={() => { setSelectedVideo(null); setActiveTab('browse'); }}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'browse' ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-300 hover:text-white'}`}
            >
              Browse
            </button>
            {token ? (
              <>
                <button 
                  onClick={() => { setSelectedVideo(null); setActiveTab('upload'); }}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${activeTab === 'upload' ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-300 hover:text-white'}`}
                >
                  <Plus className="h-4 w-4" /> Upload
                </button>
                <button 
                  onClick={() => { setSelectedVideo(null); setActiveTab('dashboard'); }}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${activeTab === 'dashboard' ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-300 hover:text-white'}`}
                >
                  <BarChart2 className="h-4 w-4" /> Stats
                </button>
                <div className="h-4 w-px bg-slate-800" />
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-400 hidden sm:inline">{currentUser?.username}</span>
                  <button 
                    onClick={() => { setToken(''); setActiveTab('browse'); setSelectedVideo(null); }}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800/80 rounded-lg transition-all"
                    title="Log Out"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              </>
            ) : (
              <button 
                onClick={() => setActiveTab('auth')}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 rounded-xl transition-all shadow-md flex items-center gap-1.5"
              >
                <LogIn className="h-4 w-4" /> Sign In
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Browse Tab */}
        {activeTab === 'browse' && (
          <div>
            {selectedVideo ? (
              /* Playback Page */
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                    <video 
                      ref={videoRef}
                      src={getMediaUrl(selectedVideo.videoUrl)}
                      controls 
                      autoPlay
                      className="w-full aspect-video object-contain"
                    />
                    <div className="p-6">
                      <h1 className="text-2xl font-bold mb-2">{selectedVideo.title}</h1>
                      <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-slate-400 border-b border-slate-800 pb-4 mb-4">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1"><Eye className="h-4 w-4" /> {selectedVideo.views} views</span>
                          <span className="flex items-center gap-1"><User className="h-4 w-4" /> {selectedVideo.uploader?.username || 'Unknown'}</span>
                        </div>
                        <span>Uploaded on {new Date(selectedVideo.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-slate-300 leading-relaxed whitespace-pre-line">{selectedVideo.description || 'No description provided.'}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedVideo(null)}
                    className="mt-4 px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
                  >
                    ← Back to videos
                  </button>
                </div>
                
                {/* Sidebar - Up Next / Related */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-300">More Videos</h3>
                  {videos.filter(v => v._id !== selectedVideo._id).slice(0, 5).map(video => (
                    <div 
                      key={video._id}
                      onClick={() => selectVideo(video)}
                      className="flex gap-3 bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 p-2.5 rounded-xl cursor-pointer hover:border-slate-700 transition-all group"
                    >
                      <div className="relative w-32 aspect-video bg-slate-950 rounded-lg overflow-hidden flex-shrink-0">
                        {video.thumbnailUrl ? (
                          <img src={getMediaUrl(video.thumbnailUrl)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500">
                            <Video className="h-6 w-6" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col justify-center min-w-0">
                        <h4 className="font-semibold text-sm line-clamp-1 group-hover:text-indigo-400 transition-colors">{video.title}</h4>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-1">by {video.uploader?.username}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{video.views} views</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Video Gallery Page */
              <>
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-3xl font-extrabold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                      Explore Streams
                    </h2>
                    <p className="text-slate-400 mt-1">High quality streaming on a cloud-native platform.</p>
                  </div>
                  {token && (
                    <button 
                      onClick={() => setActiveTab('upload')}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-medium text-sm flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all transform hover:-translate-y-0.5"
                    >
                      <Upload className="h-4 w-4" /> Upload Video
                    </button>
                  )}
                </div>

                {videos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-slate-800 rounded-2xl">
                    <Video className="h-16 w-16 text-slate-600 mb-4" />
                    <p className="text-lg font-semibold text-slate-400">No videos found</p>
                    <p className="text-slate-500 text-sm mt-1">Be the first to upload a video to StreamSphere!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {videos.map(video => (
                      <div 
                        key={video._id}
                        onClick={() => selectVideo(video)}
                        className="bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden cursor-pointer hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/5 transition-all group"
                      >
                        <div className="relative aspect-video bg-slate-950 flex items-center justify-center overflow-hidden">
                          {video.thumbnailUrl ? (
                            <img src={getMediaUrl(video.thumbnailUrl)} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          ) : (
                            <Video className="h-10 w-10 text-slate-600" />
                          )}
                          <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <div className="p-3 bg-indigo-600 rounded-full text-white shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                              <Play className="h-5 w-5 fill-current" />
                            </div>
                          </div>
                        </div>
                        <div className="p-4">
                          <h3 className="font-bold text-base text-slate-100 group-hover:text-indigo-400 transition-colors line-clamp-1">{video.title}</h3>
                          <p className="text-sm text-slate-400 mt-1 line-clamp-2 min-h-[2.5rem]">{video.description || 'No description.'}</p>
                          <div className="flex items-center justify-between text-xs text-slate-500 mt-4 pt-3 border-t border-slate-800">
                            <span className="font-medium text-slate-400">{video.uploader?.username}</span>
                            <span>{video.views} views</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Upload className="h-6 w-6 text-indigo-500" /> Publish a Video
              </h2>

              {uploadSuccess && (
                <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold">Upload Successful!</h4>
                    <p className="text-sm text-emerald-500/80 mt-0.5">Your video is processing and thumbnails are generating.</p>
                  </div>
                </div>
              )}

              {uploadError && (
                <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <p className="text-sm">{uploadError}</p>
                </div>
              )}

              <form onSubmit={handleUpload} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Video Title *</label>
                  <input
                    type="text"
                    required
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="Enter an catchy title for your video"
                    className="w-full px-4 py-3 bg-slate-800/80 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-slate-100 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Description</label>
                  <textarea
                    rows={4}
                    value={uploadDesc}
                    onChange={(e) => setUploadDesc(e.target.value)}
                    placeholder="Tell your viewers about your video..."
                    className="w-full px-4 py-3 bg-slate-800/80 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-slate-100 transition-all resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Select Video File *</label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-700 border-dashed rounded-xl hover:border-indigo-500/50 transition-colors bg-slate-800/40">
                    <div className="space-y-1 text-center">
                      <Video className="mx-auto h-12 w-12 text-slate-500" />
                      <div className="flex text-sm text-slate-400 justify-center">
                        <label className="relative cursor-pointer bg-transparent rounded-md font-semibold text-indigo-400 hover:text-indigo-300 focus-within:outline-none">
                          <span>Upload a file</span>
                          <input 
                            type="file" 
                            accept="video/*"
                            required
                            onChange={(e) => setUploadFile(e.target.files[0])}
                            className="sr-only" 
                          />
                        </label>
                      </div>
                      <p className="text-xs text-slate-500">MP4, MKV, AVI or MOV up to 100MB</p>
                      {uploadFile && (
                        <p className="text-sm font-medium text-indigo-400 mt-2">
                          Selected: {uploadFile.name} ({(uploadFile.size / (1024 * 1024)).toFixed(2)} MB)
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={uploading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold rounded-xl hover:from-indigo-600 hover:to-purple-600 transition-all transform hover:-translate-y-0.5 shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {uploading ? 'Publishing Video...' : 'Publish Video'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Stats / Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div>
            <h2 className="text-3xl font-extrabold mb-8 flex items-center gap-2">
              <BarChart2 className="h-8 w-8 text-indigo-500" /> Creator Dashboard
            </h2>

            {analytics ? (
              <div className="space-y-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400 font-medium">Total Uploads</p>
                      <h3 className="text-4xl font-extrabold mt-2 text-indigo-400">{analytics.personal.totalUploads}</h3>
                    </div>
                    <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
                      <Film className="h-6 w-6" />
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400 font-medium">Total Views</p>
                      <h3 className="text-4xl font-extrabold mt-2 text-purple-400">{analytics.personal.totalViews}</h3>
                    </div>
                    <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
                      <Eye className="h-6 w-6" />
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400 font-medium">Estimated Watch Time</p>
                      <h3 className="text-4xl font-extrabold mt-2 text-emerald-400">{analytics.personal.totalWatchTime}s</h3>
                    </div>
                    <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
                      <Clock className="h-6 w-6" />
                    </div>
                  </div>
                </div>

                {/* Global vs Personal Comparison */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
                  <h3 className="text-xl font-bold mb-4">Platform Insights</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-400 mb-2">My Share of Platform Views</h4>
                      <div className="h-4 bg-slate-800 rounded-full overflow-hidden flex">
                        <div 
                          className="bg-indigo-500" 
                          style={{ width: `${analytics.global.globalViews > 0 ? (analytics.personal.totalViews / analytics.global.globalViews) * 100 : 0}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        You contribute to {((analytics.global.globalViews > 0 ? (analytics.personal.totalViews / analytics.global.globalViews) * 100 : 0)).toFixed(1)}% of all platform viewership.
                      </p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-400 mb-2">My Share of Total Catalog</h4>
                      <div className="h-4 bg-slate-800 rounded-full overflow-hidden flex">
                        <div 
                          className="bg-purple-500" 
                          style={{ width: `${analytics.global.globalUploads > 0 ? (analytics.personal.totalUploads / analytics.global.globalUploads) * 100 : 0}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        You uploaded {((analytics.global.globalUploads > 0 ? (analytics.personal.totalUploads / analytics.global.globalUploads) * 100 : 0)).toFixed(1)}% of all video content.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-slate-400">Loading metrics...</div>
            )}
          </div>
        )}

        {/* Auth Tab */}
        {activeTab === 'auth' && (
          <div className="max-w-md mx-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
              <div className="flex flex-col items-center mb-6">
                <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400 mb-3">
                  <Shield className="h-8 w-8" />
                </div>
                <h2 className="text-2xl font-bold">{isRegister ? 'Create your Account' : 'Welcome Back'}</h2>
                <p className="text-sm text-slate-400 mt-1">Sign in to publish streams and view your analytics.</p>
              </div>

              {authError && (
                <div className="mb-4 p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-sm flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={handleAuth} className="space-y-4">
                {isRegister && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Username</label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="streamsphere_fan"
                      className="w-full px-4 py-3 bg-slate-800/80 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-slate-100 text-sm transition-all"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full px-4 py-3 bg-slate-800/80 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-slate-100 text-sm transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 bg-slate-800/80 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-slate-100 text-sm transition-all"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold rounded-xl hover:from-indigo-600 hover:to-purple-600 transition-all shadow-lg shadow-indigo-600/20"
                >
                  {isRegister ? 'Create Account' : 'Sign In'}
                </button>
              </form>

              <div className="mt-6 text-center text-sm">
                <button
                  onClick={() => { setIsRegister(!isRegister); setAuthError(''); }}
                  className="text-indigo-400 hover:text-indigo-300 font-medium"
                >
                  {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Create one"}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-slate-900 py-8 bg-slate-950 text-slate-500 text-sm text-center">
        <p>&copy; {new Date().getFullYear()} StreamSphere. Cloud-Native Video Streaming Platform.</p>
        <p className="text-xs text-slate-600 mt-1">Submitted for Cloud and Web Services Lab [17M15CS121]</p>
      </footer>
    </div>
  );
}
