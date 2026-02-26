'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function StudentDashboard() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await api.get('/auth/users/me');
                if (res.data.role !== 'student' && res.data.role !== 'admin') {
                    router.push('/login');
                }
                setUser(res.data);
            } catch (err) {
                router.push('/login');
            }
        };
        fetchUser();
    }, [router]);

    if (!user) return <div className="p-8">Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow-sm p-4">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <h1 className="text-xl font-bold text-gray-800">Student Portal</h1>
                    <div className="flex items-center gap-4">
                        <span>{user.username}</span>
                        <button
                            onClick={() => {
                                localStorage.removeItem('token');
                                router.push('/login');
                            }}
                            className="text-red-500 hover:text-red-700 text-sm font-medium"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto p-8">
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-2xl font-bold mb-4">My Enrolled Classes</h2>
                    <p>Student functionalities go here (View Resources, Submit Assignments).</p>
                </div>
            </main>
        </div>
    );
}
