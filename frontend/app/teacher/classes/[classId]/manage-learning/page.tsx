"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2, ArrowLeft, Plus, Edit2, Trash2, GripVertical, Check, X } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import api from '@/lib/api';

// --- Sortable Concept Component ---
function SortableConcept({ concept, onEdit, onDelete }: any) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: concept.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className="bg-white border border-gray-200 rounded-lg p-3 mb-2 shadow-sm flex items-start gap-3 group relative z-10">
            <div {...attributes} {...listeners} className="mt-1 cursor-grab text-gray-400 hover:text-gray-600">
                <GripVertical size={16} />
            </div>
            <div className="flex-1">
                <h5 className="font-semibold text-gray-800 text-sm">{concept.name}</h5>
                {concept.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{concept.description}</p>}
            </div>
            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onEdit(concept)} className="p-1 text-blue-500 hover:bg-blue-50 rounded"><Edit2 size={14} /></button>
                <button onClick={() => onDelete(concept.id)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
            </div>
        </div>
    );
}

// --- Main Page Component ---
export default function ManageLearningPage() {
    const router = useRouter();
    const params = useParams();
    const classId = params.classId as string;

    const [topics, setTopics] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Modal states
    const [topicModal, setTopicModal] = useState<{ isOpen: boolean, data: any }>({ isOpen: false, data: null });
    const [conceptModal, setConceptModal] = useState<{ isOpen: boolean, data: any, topicId: number | null }>({ isOpen: false, data: null, topicId: null });

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const fetchKnowledge = async () => {
        try {
            const res = await api.get(`/teacher/classes/${classId}/knowledge`);
            if (res.data && res.data.topics) {
                // Ensure every topic has a concept array even if empty
                const formattedTopics = res.data.topics.map((t: any) => ({
                    ...t,
                    concepts: t.concepts || []
                }));
                // Sort topics by ID just to have a stable order
                formattedTopics.sort((a: any, b: any) => a.id - b.id);
                setTopics(formattedTopics);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (classId) fetchKnowledge();
    }, [classId]);

    // --- Drag and Drop Handlers ---
    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeConceptId = active.id;
        const overId = over.id; // Could be another concept ID, or a Topic ID (if dragging to empty container)

        // Find source topic and concept
        let sourceTopic: any = null;
        let activeConcept: any = null;

        topics.forEach(t => {
            const c = t.concepts.find((x: any) => x.id === activeConceptId);
            if (c) {
                sourceTopic = t;
                activeConcept = c;
            }
        });

        if (!sourceTopic || !activeConcept) return;

        // Find destination topic
        let destTopic: any = null;
        topics.forEach(t => {
            if (t.id === overId) destTopic = t; // Dropped directly on topic container
            else if (t.concepts.find((x: any) => x.id === overId)) destTopic = t; // Dropped on another concept
        });

        if (!destTopic) return;

        // If moving within the same topic (reordering - ignoring backend sync for now since we don't store sort index, but UI updates)
        if (sourceTopic.id === destTopic.id) {
            const oldIndex = sourceTopic.concepts.findIndex((c: any) => c.id === activeConceptId);
            const newIndex = destTopic.concepts.findIndex((c: any) => c.id === overId);

            if (oldIndex !== newIndex) {
                setTopics(prev => prev.map(t => {
                    if (t.id === sourceTopic.id) {
                        return { ...t, concepts: arrayMove(t.concepts, oldIndex, newIndex) };
                    }
                    return t;
                }));
            }
            return;
        }

        // --- Moving to a DIFFERENT topic ---
        // 1. Optimistic UI update
        setTopics(prev => {
            return prev.map(t => {
                if (t.id === sourceTopic.id) {
                    return { ...t, concepts: t.concepts.filter((c: any) => c.id !== activeConceptId) };
                }
                if (t.id === destTopic.id) {
                    return { ...t, concepts: [...t.concepts, activeConcept] };
                }
                return t;
            });
        });

        // 2. Sync to Backend
        try {
            await api.put(`/teacher/concepts/${activeConceptId}`, { topic_id: destTopic.id });
        } catch (err) {
            console.error("Failed to move concept", err);
            fetchKnowledge(); // Revert on failure
        }
    };

    // --- API Handlers ---
    const handleSaveTopic = async (e: React.FormEvent) => {
        e.preventDefault();
        const fd = new FormData(e.target as HTMLFormElement);
        const name = fd.get('name') as string;
        const outline = fd.get('outline') as string;
        if (!name || !topicModal.data) return;

        try {
            await api.put(`/teacher/topics/${topicModal.data.id}`, { name, outline });
            setTopicModal({ isOpen: false, data: null });
            fetchKnowledge();
        } catch (err) { console.error(err); }
    };
    const handleSaveConcept = async (e: React.FormEvent) => {
        e.preventDefault();
        const fd = new FormData(e.target as HTMLFormElement);
        const name = fd.get('name') as string;
        const description = fd.get('description') as string;
        if (!name) return;

        try {
            if (conceptModal.data) {
                // Edit
                await api.put(`/teacher/concepts/${conceptModal.data.id}`, { name, description });
            } else if (conceptModal.topicId) {
                // Create
                await api.post(`/teacher/topics/${conceptModal.topicId}/concepts`, { name, description });
            }
            setConceptModal({ isOpen: false, data: null, topicId: null });
            fetchKnowledge();
        } catch (err) { console.error(err); }
    };

    const handleDeleteConcept = async (id: number) => {
        if (!confirm("Delete this concept?")) return;
        try {
            await api.delete(`/teacher/concepts/${id}`);
            fetchKnowledge();
        } catch (err) { console.error(err); }
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-purple-600" /></div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 bg-gray-100 p-2 rounded-full transition-colors">
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Manage Learning Structure</h1>
                            <p className="text-gray-500 text-sm">Drag and drop concepts to re-organize your curriculum.</p>
                        </div>
                    </div>
                </div>

                {/* DND Context mapping vertical list area */}
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <div className="flex flex-col gap-6 pb-8 pt-2">
                        {topics.map(topic => (
                            <div key={topic.id} id={topic.id.toString()} className="w-full bg-gray-100 rounded-xl border border-gray-300 flex flex-col">

                                {/* Topic Header */}
                                <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-xl group">
                                    <div className="flex justify-between items-start mb-1">
                                        <div>
                                            <h3 className="font-bold text-gray-900 leading-tight">{topic.name}</h3>
                                            {topic.resource_names && topic.resource_names.length > 0 && (
                                                <p className="text-xs text-purple-600 font-medium mt-1">
                                                    From: {topic.resource_names.join(', ')}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => setTopicModal({ isOpen: true, data: topic })} className="text-blue-600 p-1 hover:bg-blue-100 rounded"><Edit2 size={14} /></button>
                                        </div>
                                    </div>
                                    {topic.outline && <p className="text-sm text-gray-600 mt-2">{topic.outline}</p>}
                                </div>

                                {/* Concepts List (Sortable Area) */}
                                <div className="p-4 flex-1">
                                    <SortableContext items={topic.concepts.map((c: any) => c.id)} strategy={verticalListSortingStrategy}>
                                        <div className="min-h-[100px]">
                                            {topic.concepts.map((concept: any) => (
                                                <SortableConcept
                                                    key={concept.id}
                                                    concept={concept}
                                                    onEdit={(c: any) => setConceptModal({ isOpen: true, data: c, topicId: topic.id })}
                                                    onDelete={handleDeleteConcept}
                                                />
                                            ))}
                                            {topic.concepts.length === 0 && (
                                                <div className="h-full flex items-center justify-center text-gray-400 text-sm italic border-2 border-dashed border-gray-300 rounded-lg py-8">
                                                    Drop concepts here
                                                </div>
                                            )}
                                        </div>
                                    </SortableContext>
                                </div>

                                {/* Add Concept Button */}
                                <div className="p-3 bg-white rounded-b-xl border-t border-gray-200">
                                    <button
                                        onClick={() => setConceptModal({ isOpen: true, data: null, topicId: topic.id })}
                                        className="w-full py-2 flex items-center justify-center gap-2 text-sm font-medium text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition"
                                    >
                                        <Plus size={16} /> Add Concept
                                    </button>
                                </div>

                            </div>
                        ))}
                    </div>
                </DndContext>

                {topicModal.isOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl shadow-xl p-6 w-[400px]">
                            <h2 className="text-xl font-bold mb-4">Edit Topic</h2>
                            <form onSubmit={handleSaveTopic} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                    <input name="name" defaultValue={topicModal.data?.name} required className="w-full border rounded-lg px-3 py-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Outline (Optional)</label>
                                    <textarea name="outline" defaultValue={topicModal.data?.outline} className="w-full border rounded-lg px-3 py-2 h-24" />
                                </div>
                                <div className="flex justify-end gap-2 pt-4 border-t">
                                    <button type="button" onClick={() => setTopicModal({ isOpen: false, data: null })} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                                    <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-lg">Save</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {conceptModal.isOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl shadow-xl p-6 w-[400px]">
                            <h2 className="text-xl font-bold mb-4">{conceptModal.data ? 'Edit Concept' : 'New Concept'}</h2>
                            <form onSubmit={handleSaveConcept} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                    <input name="name" defaultValue={conceptModal.data?.name} required className="w-full border rounded-lg px-3 py-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                                    <textarea name="description" defaultValue={conceptModal.data?.description} className="w-full border rounded-lg px-3 py-2 h-24" />
                                </div>
                                <div className="flex justify-end gap-2 pt-4 border-t">
                                    <button type="button" onClick={() => setConceptModal({ isOpen: false, data: null, topicId: null })} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                                    <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-lg">Save</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
