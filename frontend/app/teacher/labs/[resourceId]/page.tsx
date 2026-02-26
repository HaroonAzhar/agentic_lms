'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '@/lib/api';
import { ArrowLeft, Play, Clock, FileText, Edit2, Save, X } from 'lucide-react';

interface Concept {
    id: number;
    name: string;
    description: string;
    timestamp: number;
}

interface Topic {
    id: number;
    name: string;
    concepts: Concept[];
}

export default function LabPage() {
    const router = useRouter();
    const params = useParams();
    const resourceId = params.resourceId;

    const [resource, setResource] = useState<any>(null);
    const [topics, setTopics] = useState<Topic[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTimestamp, setActiveTimestamp] = useState(0);

    // Edit State
    const [editingConcept, setEditingConcept] = useState<number | null>(null);
    const [editData, setEditData] = useState<{ name: string, description: string }>({ name: '', description: '' });

    useEffect(() => {
        if (!resourceId) return;

        const fetchData = async () => {
            try {
                const res = await api.get(`/teacher/resources/${resourceId}/analysis`);
                setResource(res.data.resource);
                setTopics(res.data.topics);
            } catch (err) {
                console.error(err);
                alert('Failed to load resource data');
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        // Poll for updates if analysis is empty?
        const interval = setInterval(() => {
            // fetchData(); 
        }, 10000);
        return () => clearInterval(interval);
    }, [resourceId]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const startEdit = (concept: Concept) => {
        setEditingConcept(concept.id);
        setEditData({ name: concept.name, description: concept.description });
    };

    const saveEdit = async (conceptId: number) => {
        try {
            await api.put(`/teacher/key-concepts/${conceptId}`, {
                name: editData.name,
                description: editData.description
            });
            // Update local state
            setTopics(prev => prev.map(topic => ({
                ...topic,
                concepts: topic.concepts.map(c =>
                    c.id === conceptId ? { ...c, name: editData.name, description: editData.description } : c
                )
            })));
            setEditingConcept(null);
        } catch (err) {
            console.error(err);
            alert('Failed to save changes');
        }
    };

    if (loading) return <div className="flex h-screen items-center justify-center">Loading Lab...</div>;

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col">
            {/* Header */}
            <header className="h-16 border-b border-gray-800 flex items-center px-6 gap-4 bg-gray-900">
                <button
                    onClick={() => router.back()}
                    className="p-2 hover:bg-gray-800 rounded-full transition-colors"
                >
                    <ArrowLeft size={20} className="text-gray-400" />
                </button>
                <div>
                    <h1 className="text-lg font-semibold">{resource?.title}</h1>
                    <p className="text-xs text-gray-500 uppercase">{resource?.type}</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <span className="px-3 py-1 bg-blue-900/50 text-blue-400 text-xs rounded-full border border-blue-800">
                        Teacher Access
                    </span>
                </div>
            </header>

            {/* Main Layout */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Resource Content (Video/PDF) */}
                <div className="flex-1 bg-black flex items-center justify-center p-4">
                    {resource?.type === 'video' ? (
                        <div className="w-full max-w-4xl aspect-video bg-gray-800 rounded-lg overflow-hidden relative">
                            {/* In a real app, use a proper Video Player component (e.g. react-player) */}
                            <video
                                src={resource.url}
                                controls
                                className="w-full h-full object-contain"
                                onTimeUpdate={(e) => setActiveTimestamp(Math.floor(e.currentTarget.currentTime))}
                            />
                        </div>
                    ) : (
                        <div className="w-full h-full bg-white text-black p-8 rounded-lg overflow-auto">
                            <div className="flex items-center gap-2 mb-4 text-blue-600">
                                <FileText size={24} />
                                <h2 className="text-xl font-bold">Document Viewer</h2>
                            </div>
                            <a href={resource?.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
                                Open Document
                            </a>
                        </div>
                    )}
                </div>

                {/* Right: AI Analysis Panel */}
                <div className="w-96 bg-gray-800 border-l border-gray-700 flex flex-col">
                    <div className="p-4 border-b border-gray-700">
                        <h2 className="font-semibold flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            AI Analysis
                        </h2>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {topics.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                                <p>Analyzing content...</p>
                                <p className="text-xs mt-2">This may take a few minutes.</p>
                            </div>
                        ) : (
                            topics.map((topic) => (
                                <div key={topic.id} className="space-y-3">
                                    <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wider">
                                        {topic.name}
                                    </h3>
                                    <div className="space-y-2">
                                        {topic.concepts.map((concept) => (
                                            <div
                                                key={concept.id}
                                                className={`p-3 rounded-lg border border-gray-700 transition-all ${editingConcept === concept.id ? 'bg-gray-700 border-blue-500' :
                                                    Math.abs(concept.timestamp - activeTimestamp) < 5 ? 'border-blue-500 bg-blue-900/20' : 'bg-gray-800'
                                                    }`}
                                            >
                                                {editingConcept === concept.id ? (
                                                    <div className="space-y-2">
                                                        <input
                                                            type="text"
                                                            value={editData.name}
                                                            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                                                            className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:border-blue-500 outline-none"
                                                        />
                                                        <textarea
                                                            value={editData.description}
                                                            onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                                                            className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-gray-300 focus:border-blue-500 outline-none"
                                                            rows={3}
                                                        />
                                                        <div className="flex justify-end gap-2">
                                                            <button
                                                                onClick={() => setEditingConcept(null)}
                                                                className="p-1 hover:bg-gray-600 rounded text-gray-400"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => saveEdit(concept.id)}
                                                                className="p-1 hover:bg-blue-600 rounded text-blue-400 hover:text-white"
                                                            >
                                                                <Save size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div onClick={() => {
                                                        // Seek video logic would go here
                                                        // e.g. videoRef.current.currentTime = concept.timestamp
                                                    }} className="cursor-pointer">
                                                        <div className="flex justify-between items-start mb-1 group">
                                                            <h4 className="font-medium text-blue-400 text-sm">{concept.name}</h4>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        startEdit(concept);
                                                                    }}
                                                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded text-gray-400 transition-opacity"
                                                                >
                                                                    <Edit2 size={12} />
                                                                </button>
                                                                <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-900 px-1.5 py-0.5 rounded">
                                                                    <Clock size={10} />
                                                                    {formatTime(concept.timestamp)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <p className="text-xs text-gray-400 line-clamp-2">
                                                            {concept.description}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
