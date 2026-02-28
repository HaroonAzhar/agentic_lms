"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2, ArrowLeft, Users, CheckCircle, Clock } from 'lucide-react';
import api from '@/lib/api';

export default function TeacherSubmissionsListPage() {
    const router = useRouter();
    const params = useParams();
    const assignmentId = params.assignmentId as string;

    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchSubmissions = async () => {
            try {
                const res = await api.get(`/teacher/assignments/${assignmentId}/submissions`);
                if (res.data) {
                    setData(res.data);
                }
            } catch (err) {
                console.error(err);
                router.back();
            } finally {
                setIsLoading(false);
            }
        };
        if (assignmentId) fetchSubmissions();
    }, [assignmentId, router]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-50">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
        );
    }

    if (!data) return null;

    const submittedCount = data.submissions.filter((s: any) => s.submitted).length;
    const totalCount = data.submissions.length;

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="text-gray-500 hover:text-gray-700 transition-colors p-2 bg-white rounded-full shadow-sm border"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">{data.title}</h1>
                            <p className="text-gray-500 mt-1">Student Submissions</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-100 text-blue-600 rounded-lg"><Users size={24} /></div>
                            <div>
                                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Students</p>
                                <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-green-100 text-green-600 rounded-lg"><CheckCircle size={24} /></div>
                            <div>
                                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Submitted</p>
                                <p className="text-2xl font-bold text-gray-900">{submittedCount}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-yellow-100 text-yellow-600 rounded-lg"><Clock size={24} /></div>
                            <div>
                                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Pending</p>
                                <p className="text-2xl font-bold text-gray-900">{totalCount - submittedCount}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                        <h2 className="text-lg font-bold text-gray-800">Class Roster</h2>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {data.submissions.map((student: any) => (
                            <div key={student.student_id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                <div className="flex flex-col">
                                    <span className="font-bold text-gray-900 text-lg">{student.student_name}</span>
                                    <span className="text-sm text-gray-500">ID: {student.student_id}</span>
                                </div>
                                <div className="flex items-center gap-6">
                                    {student.submitted ? (
                                        <div className="flex items-center gap-4">
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-green-100 text-green-800">
                                                {student.marks !== null ? `${student.marks}%` : 'Graded'}
                                            </span>
                                            <button
                                                onClick={() => router.push(`/teacher/assignments/${assignmentId}/submissions/${student.student_id}`)}
                                                className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition shadow-sm"
                                            >
                                                Review Marks
                                            </button>
                                        </div>
                                    ) : (
                                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
                                            <Clock size={16} /> Not Submitted
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                        {data.submissions.length === 0 && (
                            <div className="p-12 text-center text-gray-500">
                                No students enrolled in this class yet.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
