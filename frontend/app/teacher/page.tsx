'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { BookOpen, ChevronRight, LogOut } from 'lucide-react';

interface Class {
    id: number;
    name: string;
    course_name: string;
}

export default function TeacherClassSelection() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [classes, setClasses] = useState<Class[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const userRes = await api.get('/auth/users/me');
                if (userRes.data.role !== 'teacher' && userRes.data.role !== 'admin') {
                    router.push('/login');
                    return;
                }
                setUser(userRes.data);

                const classesRes = await api.get('/teacher/classes');
                setClasses(classesRes.data);
            } catch (err) {
                console.error(err);
                router.push('/login');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [router]);

    if (loading) return <div className="p-8 flex justify-center text-gray-500">Loading Classes...</div>;

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-blue-600" />
                            Teacher Portal
                        </h1>
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

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Select a Class</h2>

                {classes.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
                        You have not been assigned to any classes yet.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {classes.map((cls) => (
                            <div
                                key={cls.id}
                                onClick={() => router.push(`/teacher/classes/${cls.id}`)}
                                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden border border-gray-100 group"
                            >
                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600 group-hover:bg-blue-100 transition-colors">
                                            <BookOpen size={24} />
                                        </div>
                                        <ChevronRight className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900 mb-1">{cls.name}</h3>
                                    <p className="text-sm text-gray-500">{cls.course_name}</p>
                                </div>
                                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                                    <span className="text-sm text-gray-500 font-medium">View Dashboard</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
