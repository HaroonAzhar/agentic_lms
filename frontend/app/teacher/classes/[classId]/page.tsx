'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '@/lib/api';
import { ArrowLeft, LogOut, BookOpen, Layers, ListChecks, Users, GraduationCap, TrendingUp, Clock, AlertCircle } from 'lucide-react';

interface Class {
    id: number;
    name: string;
    course_name: string;
}

export default function ClassDashboard() {
    const router = useRouter();
    const params = useParams();
    const classId = params.classId;

    const [user, setUser] = useState<any>(null);
    const [classData, setClassData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [resources, setResources] = useState<any[]>([]);
    const [assignments, setAssignments] = useState<any[]>([]);
    const [uploading, setUploading] = useState(false);

    // Upload Modal State
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [newResourceTitle, setNewResourceTitle] = useState('');
    const [newResourceType, setNewResourceType] = useState('video');
    const [newResourceFile, setNewResourceFile] = useState<File | null>(null);

    // Assignment Modal State
    const [showAssignmentModal, setShowAssignmentModal] = useState(false);
    const [newAssignmentTitle, setNewAssignmentTitle] = useState('');
    const [newAssignmentQuestions, setNewAssignmentQuestions] = useState([{ question: '', answer: '' }]);
    const [creatingAssignment, setCreatingAssignment] = useState(false);

    const fetchClassDetails = async () => {
        try {
            const [usersRes, classesRes, resourcesRes, assignmentsRes] = await Promise.all([
                api.get('/auth/users/me'),
                api.get('/teacher/classes'),
                api.get(`/teacher/classes/${classId}/resources`),
                api.get(`/teacher/class/activity/${classId}`)
            ]);

            if (usersRes.data.role !== 'teacher' && usersRes.data.role !== 'admin') {
                router.push('/login');
                return;
            }
            setUser(usersRes.data);

            const foundClass = classesRes.data.find((c: Class) => c.id === parseInt(classId as string));
            if (!foundClass) {
                alert('You do not have access to this class');
                router.push('/teacher');
                return;
            }
            setClassData(foundClass);
            setResources(resourcesRes.data);
            setAssignments(assignmentsRes.data);

        } catch (err) {
            console.error(err);
            router.push('/login');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!classId) return;
        fetchClassDetails();
    }, [router, classId]);

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newResourceFile || !classId) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('title', newResourceTitle);
        formData.append('type', newResourceType);
        formData.append('class_id', classId as string);
        formData.append('file', newResourceFile);

        try {
            await api.post('/teacher/resources', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setShowUploadModal(false);
            setNewResourceTitle('');
            setNewResourceFile(null);
            // Refresh resources
            const res = await api.get(`/teacher/classes/${classId}/resources`);
            setResources(res.data);
            alert('Resource uploaded successfully! Analysis started.');
        } catch (err: any) {
            console.error(err);
            const errorMessage = err.response?.data?.detail || err.message || 'Failed to upload resource';
            // setError(errorMessage); // removed as not defined
            alert(`Error: ${errorMessage}`);
        } finally {
            setUploading(false);
        }
    };

    const deleteResource = async (resourceId: number) => {
        try {
            await api.delete(`/teacher/resources/${resourceId}`);
            setResources(prev => prev.filter(r => r.id !== resourceId));
        } catch (err) {
            console.error(err);
            alert('Failed to delete resource');
        }
    };

    const handleCreateAssignment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAssignmentTitle || !classId) return;

        setCreatingAssignment(true);
        try {
            const payload = {
                title: newAssignmentTitle,
                questions: { list: newAssignmentQuestions },
                class_id: parseInt(classId as string)
            };
            const res = await api.post(`/teacher/class/activity/${classId}`, payload);
            setAssignments([...assignments, res.data]);
            setShowAssignmentModal(false);
            setNewAssignmentTitle('');
            setNewAssignmentQuestions([{ question: '', answer: '' }]);
            alert('Assignment created successfully!');
        } catch (err: any) {
            console.error(err);
            alert(`Error creating assignment: ${err.message}`);
        } finally {
            setCreatingAssignment(false);
        }
    };

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 12;

    const indexOfLastResource = currentPage * itemsPerPage;
    const indexOfFirstResource = indexOfLastResource - itemsPerPage;
    const currentResources = resources.slice(indexOfFirstResource, indexOfLastResource);
    const totalPages = Math.ceil(resources.length / itemsPerPage);

    const handlePreviousPage = () => {
        if (currentPage > 1) setCurrentPage(prev => prev - 1);
    };

    const handleNextPage = () => {
        if (currentPage < totalPages) setCurrentPage(prev => prev + 1);
    };

    if (loading) return <div className="p-8 flex justify-center text-gray-500">Loading Dashboard...</div>;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Navbar */}
            <nav className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/teacher')}
                                className="text-gray-500 hover:text-gray-700 transition-colors"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <BookOpen className="w-5 h-5 text-blue-600" />
                                {classData?.name} <span className="text-gray-400 font-normal">| {classData?.course_name}</span>
                            </h1>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-gray-600">Welcome, {user?.username}</span>
                            <button
                                onClick={() => {
                                    localStorage.removeItem('token');
                                    router.push('/login');
                                }}
                                className="text-red-500 hover:text-red-700 text-sm font-medium flex items-center gap-1"
                            >
                                <LogOut size={16} />
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col lg:flex-row gap-8">
                    {/* LEFT COLUMN: Main Content */}
                    <div className="flex-1 space-y-8">
                        {/* Actions Header */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Class Dashboard</h2>
                                <p className="text-gray-500 mt-1">Manage learning resources and activities.</p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowUploadModal(true)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm flex items-center gap-2 font-medium transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                                    Add Resource
                                </button>
                                <button
                                    onClick={() => setShowAssignmentModal(true)}
                                    className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm flex items-center gap-2 font-medium transition-colors"
                                >
                                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    Create Activity
                                </button>
                            </div>
                        </div>

                        <div className="space-y-12">
                            {/* Resources Grid */}
                            <section>
                                <div className="flex items-center gap-2 mb-6">
                                    <Layers className="text-blue-500" size={24} />
                                    <h3 className="text-xl font-bold text-gray-900">Resources</h3>
                                    <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">{resources.length}</span>
                                </div>

                                {resources.length === 0 ? (
                                    <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
                                        <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
                                            <Layers size={48} />
                                        </div>
                                        <h3 className="text-lg font-medium text-gray-900">No resources yet</h3>
                                        <p className="text-gray-500 mt-2">Upload videos or documents to get started with AI analysis.</p>
                                        <button
                                            onClick={() => setShowUploadModal(true)}
                                            className="mt-6 text-blue-600 hover:text-blue-500 font-medium"
                                        >
                                            Upload your first resource &rarr;
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                            {currentResources.map((resource) => (
                                                <div
                                                    key={resource.id}
                                                    className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer group relative"
                                                    onClick={() => router.push(`/teacher/labs/${resource.id}`)}
                                                >
                                                    <div className="h-40 bg-gray-100 flex items-center justify-center relative group-hover:bg-blue-50 transition-colors">
                                                        {/* Preview Placeholder / Icon based on type */}
                                                        {resource.type === 'VIDEO' || resource.type === 'video' ? (
                                                            <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center text-red-500">
                                                                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                                            </div>
                                                        ) : (
                                                            <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-500">
                                                                <BookOpen size={32} />
                                                            </div>
                                                        )}

                                                        {/* Overlay Badge */}
                                                        <span className="absolute top-4 right-4 bg-white/90 backdrop-blur px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider text-gray-600 shadow-sm">
                                                            {resource.type}
                                                        </span>
                                                    </div>
                                                    <div className="p-4">
                                                        <h4 className="font-bold text-gray-900 mb-2 line-clamp-2 text-sm group-hover:text-blue-600 transition-colors h-10 leading-tight">
                                                            {resource.title}
                                                        </h4>
                                                        <div className="flex items-center justify-between text-xs text-gray-500 mt-3">
                                                            <span className="flex items-center gap-1">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                                                Analyzed
                                                            </span>

                                                            {/* Delete Button (Stop Propagation to prevent nav) */}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (confirm('Are you sure you want to delete this resource?')) {
                                                                        deleteResource(resource.id);
                                                                    }
                                                                }}
                                                                className="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors"
                                                                title="Delete Resource"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Pagination Controls */}
                                        {totalPages > 1 && (
                                            <div className="flex justify-center items-center gap-4 mt-8">
                                                <button
                                                    onClick={handlePreviousPage}
                                                    disabled={currentPage === 1}
                                                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Previous
                                                </button>
                                                <span className="text-sm text-gray-700">
                                                    Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span>
                                                </span>
                                                <button
                                                    onClick={handleNextPage}
                                                    disabled={currentPage === totalPages}
                                                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Next
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </section>

                            {/* Assignments List (Below) */}
                            <section className="border-t pt-8">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                        <span className="p-1 bg-purple-100 rounded-md text-purple-600"><BookOpen size={20} /></span>
                                        Assignments
                                    </h3>
                                </div>

                                {assignments.length === 0 ? (
                                    <div className="p-8 text-center text-gray-500 bg-white rounded-xl border border-gray-200 border-dashed">
                                        <div className="mx-auto h-12 w-12 text-gray-400 mb-3">
                                            <BookOpen size={48} />
                                        </div>
                                        <h4 className="text-lg font-medium text-gray-900">No assignments yet</h4>
                                        <p className="mt-1">Assignments will appear here once you create them.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {assignments.map(assignment => (
                                            <div key={assignment.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center group hover:shadow-md transition-all">
                                                <div>
                                                    <h4 className="font-bold text-gray-900">{assignment.title}</h4>
                                                    <p className="text-sm text-gray-500">{assignment.questions?.list?.length || 0} Questions</p>
                                                </div>
                                                <button className="text-blue-600 hover:text-blue-800 text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors">
                                                    View Details
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Sidebar */}
                    <aside className="w-full lg:w-96 space-y-8">
                        {/* Class Summary Card */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <TrendingUp size={20} className="text-green-600" />
                                Class Summary
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-100 text-blue-600 rounded-md">
                                            <Layers size={18} />
                                        </div>
                                        <div className="text-sm font-medium text-gray-600">Resources</div>
                                    </div>
                                    <div className="text-lg font-bold text-gray-900">{resources.length}</div>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-purple-100 text-purple-600 rounded-md">
                                            <Users size={18} />
                                        </div>
                                        <div className="text-sm font-medium text-gray-600">Students</div>
                                    </div>
                                    <div className="text-lg font-bold text-gray-900">24</div> {/* Mock */}
                                </div>

                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-yellow-100 text-yellow-600 rounded-md">
                                            <GraduationCap size={18} />
                                        </div>
                                        <div className="text-sm font-medium text-gray-600">Avg. Grade</div>
                                    </div>
                                    <div className="text-lg font-bold text-gray-900">B+</div> {/* Mock */}
                                </div>
                            </div>
                        </div>

                        {/* Quiz List Card */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <ListChecks size={20} className="text-orange-600" />
                                    Quizzes
                                </h3>
                                <button className="text-xs text-blue-600 hover:underline font-medium">View All</button>
                            </div>

                            <div className="space-y-3">
                                {assignments.length === 0 ? (
                                    <div className="text-center text-gray-500 text-sm py-4">
                                        No quizzes created yet.
                                    </div>
                                ) : (
                                    assignments.map((assignment, index) => (
                                        <div key={assignment.id} className="group flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100 cursor-pointer">
                                            <div className="mt-1 p-1.5 bg-orange-100 text-orange-600 rounded text-xs font-bold">Q{index + 1}</div>
                                            <div>
                                                <h4 className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">{assignment.title}</h4>
                                                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                                    <span className="flex items-center gap-0.5"><Clock size={10} /> {assignment.questions?.list?.length * 5 || 10}m</span>
                                                    <span>•</span>
                                                    <span>{assignment.questions?.list?.length || 0} Questions</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}

                                <div className="p-3 text-center border-t mt-2">
                                    <button
                                        onClick={() => setShowAssignmentModal(true)}
                                        className="text-sm text-gray-500 hover:text-gray-800 border-dashed border border-gray-300 rounded-lg w-full py-2 hover:bg-gray-50 transition-colors"
                                    >
                                        + Create New Quiz
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Help / Tips */}
                        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                            <div className="flex gap-3">
                                <AlertCircle className="text-blue-600 shrink-0" size={20} />
                                <div>
                                    <h4 className="text-sm font-bold text-blue-900">Did you know?</h4>
                                    <p className="text-xs text-blue-700 mt-1">You can automatically generate quizzes from your uploaded resources using the AI assistant.</p>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            </main>

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Upload New Resource</h2>
                        <form onSubmit={handleUpload} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                                <input
                                    type="text"
                                    required
                                    value={newResourceTitle}
                                    onChange={(e) => setNewResourceTitle(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="e.g., Week 1 - Intro to AI"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                <select
                                    value={newResourceType}
                                    onChange={(e) => setNewResourceType(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="video">Video</option>
                                    <option value="pdf">PDF</option>
                                    <option value="article">Article</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
                                <input
                                    type="file"
                                    required
                                    onChange={(e) => setNewResourceFile(e.target.files ? e.target.files[0] : null)}
                                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowUploadModal(false)}
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={uploading}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {uploading ? 'Uploading...' : 'Upload'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Create Assignment Modal */}
            {showAssignmentModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] flex flex-col">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Activity</h2>
                        <form onSubmit={handleCreateAssignment} className="flex-1 overflow-y-auto pr-2 space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Activity Title</label>
                                <input
                                    type="text"
                                    required
                                    value={newAssignmentTitle}
                                    onChange={(e) => setNewAssignmentTitle(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="e.g., Week 1 Quiz"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-medium text-gray-700">Questions</label>
                                    <button
                                        type="button"
                                        onClick={() => setNewAssignmentQuestions([...newAssignmentQuestions, { question: '', answer: '' }])}
                                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                    >
                                        + Add Question
                                    </button>
                                </div>
                                <div className="space-y-4">
                                    {newAssignmentQuestions.map((q, idx) => (
                                        <div key={idx} className="p-4 border rounded-lg bg-gray-50 relative">
                                            {newAssignmentQuestions.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newQs = [...newAssignmentQuestions];
                                                        newQs.splice(idx, 1);
                                                        setNewAssignmentQuestions(newQs);
                                                    }}
                                                    className="absolute top-2 right-2 text-gray-400 hover:text-red-500 text-xs"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                            <div className="mb-3">
                                                <label className="block text-xs font-semibold text-gray-500 mb-1">Question {idx + 1}</label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={q.question}
                                                    onChange={(e) => {
                                                        const newQs = [...newAssignmentQuestions];
                                                        newQs[idx].question = e.target.value;
                                                        setNewAssignmentQuestions(newQs);
                                                    }}
                                                    className="w-full px-3 py-2 text-sm border rounded-md focus:ring-1 focus:ring-blue-500 outline-none"
                                                    placeholder="Enter question text..."
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-500 mb-1">Answer (Optional)</label>
                                                <input
                                                    type="text"
                                                    value={q.answer}
                                                    onChange={(e) => {
                                                        const newQs = [...newAssignmentQuestions];
                                                        newQs[idx].answer = e.target.value;
                                                        setNewAssignmentQuestions(newQs);
                                                    }}
                                                    className="w-full px-3 py-2 text-sm border rounded-md focus:ring-1 focus:ring-blue-500 outline-none"
                                                    placeholder="Enter expected answer..."
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-white">
                                <button
                                    type="button"
                                    onClick={() => setShowAssignmentModal(false)}
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creatingAssignment}
                                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 font-medium"
                                >
                                    {creatingAssignment ? 'Creating...' : 'Create Activity'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
