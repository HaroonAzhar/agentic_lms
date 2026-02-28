'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '@/lib/api';
import { ArrowLeft, LogOut, BookOpen, Layers, ListChecks, FileText, PlayCircle, GraduationCap, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function StudentClassDashboard() {
    const router = useRouter();
    const params = useParams();
    const classId = params.classId;

    const [user, setUser] = useState<any>(null);
    const [classData, setClassData] = useState<any>(null);
    const [resources, setResources] = useState<any[]>([]);
    const [assignments, setAssignments] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchClassDetails = async () => {
        try {
            const [usersRes, classesRes, resourcesRes, assignmentsRes, statsRes] = await Promise.all([
                api.get('/auth/users/me'),
                api.get('/student/classes'),
                api.get(`/student/classes/${classId}/resources`),
                api.get(`/student/classes/${classId}/assignments`),
                api.get(`/student/classes/${classId}/stats`)
            ]);

            if (usersRes.data.role !== 'student' && usersRes.data.role !== 'admin') {
                router.push('/login');
                return;
            }
            setUser(usersRes.data);

            const foundClass = classesRes.data.find((c: any) => c.id === parseInt(classId as string));
            if (!foundClass) {
                alert('You are not enrolled in this class');
                router.push('/student');
                return;
            }

            setClassData(foundClass);
            setResources(resourcesRes.data);
            setAssignments(assignmentsRes.data);
            setStats(statsRes.data);

        } catch (err) {
            console.error(err);
            router.push('/login');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (classId) {
            fetchClassDetails();
        }
    }, [router, classId]);

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
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/student')}
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
                            <span className="text-gray-600">Student: {user?.username}</span>
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
                        {/* Header */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Class Materials</h2>
                                <p className="text-gray-500 mt-1">Review your resources and complete assignments.</p>
                            </div>
                        </div>

                        {/* Resources Grid */}
                        <section>
                            <div className="flex items-center gap-2 mb-6">
                                <Layers className="text-blue-500" size={24} />
                                <h3 className="text-xl font-bold text-gray-900">Study Resources</h3>
                                <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">{resources.length}</span>
                            </div>

                            {resources.length === 0 ? (
                                <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center bg-gray-50/50">
                                    <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
                                        <Layers size={48} />
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-900">No resources available</h3>
                                    <p className="text-gray-500 mt-2">Your teacher hasn't uploaded any study materials yet.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {currentResources.map((resource) => (
                                        <div
                                            key={resource.id}
                                            className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col"
                                        >
                                            <div className="h-40 bg-gray-100 flex items-center justify-center relative">
                                                {resource.type === 'VIDEO' || resource.type === 'video' ? (
                                                    <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center text-red-500">
                                                        <PlayCircle size={32} />
                                                    </div>
                                                ) : (
                                                    <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-500">
                                                        <FileText size={32} />
                                                    </div>
                                                )}
                                                <span className="absolute top-4 right-4 bg-white/90 backdrop-blur px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider text-gray-600 shadow-sm">
                                                    {resource.type}
                                                </span>
                                            </div>
                                            <div className="p-4 flex-1 flex flex-col">
                                                <h4 className="font-bold text-gray-900 mb-3 line-clamp-2 text-sm h-10 leading-tight">
                                                    {resource.title}
                                                </h4>
                                                <div className="mt-auto pt-4 border-t border-gray-50">
                                                    <button
                                                        onClick={() => alert('Study Resource feature coming soon!')}
                                                        className="w-full text-center text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 py-2 rounded-lg transition-colors"
                                                    >
                                                        Study with Agent
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

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
                        </section>

                        {/* Assignments Section */}
                        <section className="border-t pt-8">
                            <div className="flex items-center mb-6">
                                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                    <span className="p-1 bg-purple-100 rounded-md text-purple-600"><ListChecks size={20} /></span>
                                    Assignments & Quizzes
                                </h3>
                            </div>

                            {assignments.length === 0 ? (
                                <div className="p-8 text-center text-gray-500 bg-white rounded-xl border border-gray-200 border-dashed">
                                    <div className="mx-auto h-12 w-12 text-gray-400 mb-3">
                                        <ListChecks size={48} />
                                    </div>
                                    <h4 className="text-lg font-medium text-gray-900">No assignments</h4>
                                    <p className="mt-1">You have no tasks pending at the moment.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {assignments.map((assignment, idx) => {
                                        const assignmentStat = stats?.performance_over_time?.find((p: any) => p.assignment_name === assignment.title);
                                        const hasMarks = assignmentStat !== undefined && assignmentStat.marks !== null;

                                        return (
                                            <div key={assignment.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 hover:shadow-md transition-shadow">
                                                <div className="flex items-start gap-4">
                                                    <div className="mt-1 p-2 bg-purple-50 text-purple-600 rounded-lg shrink-0">
                                                        <ListChecks size={24} />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-gray-900 text-lg">{assignment.title}</h4>
                                                        <p className="text-sm text-gray-500 mb-1">{assignment.questions?.list?.length || 0} Questions</p>
                                                        {hasMarks ? (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                                Score: {assignmentStat.marks.toFixed(1)}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                                                Pending
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => router.push(`/student/assignments/${assignment.id}`)}
                                                    className="w-full sm:w-auto px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg shadow-sm transition-colors text-sm"
                                                >
                                                    Start Assignment
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    </div>

                    {/* RIGHT COLUMN: Sidebar */}
                    <aside className="w-full lg:w-96 space-y-8">
                        {/* Class Overview Card */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <BookOpen size={20} className="text-blue-600" />
                                Class Overview
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-100 text-blue-600 rounded-md">
                                            <Layers size={18} />
                                        </div>
                                        <div className="text-sm font-medium text-gray-600">Total Resources</div>
                                    </div>
                                    <div className="text-lg font-bold text-gray-900">{resources.length}</div>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-purple-100 text-purple-600 rounded-md">
                                            <ListChecks size={18} />
                                        </div>
                                        <div className="text-sm font-medium text-gray-600">Assignments</div>
                                    </div>
                                    <div className="text-lg font-bold text-gray-900">{assignments.length}</div>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mt-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-yellow-100 text-yellow-600 rounded-md">
                                            <GraduationCap size={18} />
                                        </div>
                                        <div className="text-sm font-medium text-gray-600">My Avg. Marks</div>
                                    </div>
                                    <div className="text-lg font-bold text-gray-900">{stats?.overall_average !== null ? stats.overall_average.toFixed(1) : '—'}</div>
                                </div>
                            </div>
                        </div>

                        {/* Topic Performance */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <TrendingUp size={20} className="text-green-600" />
                                My Topics
                            </h3>
                            {(!stats?.top_topics?.length && !stats?.lowest_topics?.length) ? (
                                <p className="text-sm text-gray-500 text-center py-4">Complete assignments to see your stats.</p>
                            ) : (
                                <div className="space-y-4">
                                    {stats?.top_topics?.length > 0 && (
                                        <div>
                                            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">My Best Topics</div>
                                            {stats.top_topics.map((t: any, i: number) => (
                                                <div key={i} className="flex justify-between items-center text-sm py-1">
                                                    <span className="text-gray-700 truncate pr-2" title={t.topic_name}>{t.topic_name}</span>
                                                    <span className="font-semibold text-green-600">{t.average_marks.toFixed(1)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {stats?.lowest_topics?.length > 0 && (
                                        <div className="pt-2 border-t mt-4">
                                            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 mt-2">Needs Review</div>
                                            {stats.lowest_topics.map((t: any, i: number) => (
                                                <div key={i} className="flex justify-between items-center text-sm py-1">
                                                    <span className="text-gray-700 truncate pr-2" title={t.topic_name}>{t.topic_name}</span>
                                                    <span className="font-semibold text-red-600">{t.average_marks.toFixed(1)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Performance Over Time Chart */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <TrendingUp size={20} className="text-blue-600" />
                                My Performance Over Time
                            </h3>
                            {stats?.performance_over_time?.length > 0 ? (
                                <div className="h-48 w-full mt-4 text-sm">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={stats.performance_over_time}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="assignment_name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                                            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                                            <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                            <Line type="monotone" dataKey="marks" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-32 flex items-center justify-center text-sm text-gray-500 border border-dashed rounded-lg">
                                    Pending activity data
                                </div>
                            )}
                        </div>
                    </aside>
                </div>
            </main>
        </div>
    );
}
