"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2, ArrowLeft, Send, Save, CheckCircle } from 'lucide-react';
import api from '@/lib/api';

export default function TeacherGradeReviewPage() {
    const router = useRouter();
    const params = useParams();
    const assignmentId = params.assignmentId as string;
    const studentId = params.studentId as string;

    const [reviewData, setReviewData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [commentTexts, setCommentTexts] = useState<Record<number, string>>({});
    const [markEdits, setMarkEdits] = useState<Record<number, number | string>>({});
    const [submittingCommentFor, setSubmittingCommentFor] = useState<number | null>(null);
    const [savingMarkFor, setSavingMarkFor] = useState<number | null>(null);
    const [savedMarkMsg, setSavedMarkMsg] = useState<number | null>(null);

    const fetchReview = async () => {
        try {
            const res = await api.get(`/teacher/assignments/${assignmentId}/submissions/${studentId}`);
            if (res.data) {
                setReviewData(res.data);

                // Initialize default marks into state for editing
                const initialMarks: Record<number, number | string> = {};
                res.data.responses.forEach((r: any) => {
                    initialMarks[r.response_id] = r.marks !== null ? r.marks : 0;
                });
                setMarkEdits(initialMarks);
            }
        } catch (err) {
            console.error(err);
            router.push(`/teacher/assignments/${assignmentId}/submissions`);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (assignmentId && studentId) fetchReview();
    }, [assignmentId, studentId, router]);

    const handleAddComment = async (responseId: number) => {
        const content = commentTexts[responseId]?.trim();
        if (!content) return;

        setSubmittingCommentFor(responseId);
        try {
            const res = await api.post(`/teacher/responses/${responseId}/comments`, { content });
            if (res.data) {
                setReviewData((prev: any) => {
                    const newResponses = prev.responses.map((r: any) => {
                        if (r.response_id === responseId) {
                            return { ...r, comments: [...r.comments, res.data] };
                        }
                        return r;
                    });
                    return { ...prev, responses: newResponses };
                });
                setCommentTexts(prev => ({ ...prev, [responseId]: "" }));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setSubmittingCommentFor(null);
        }
    };

    const handleUpdateMark = async (responseId: number) => {
        const newMark = parseFloat(markEdits[responseId] as string);
        if (isNaN(newMark) || newMark < 0 || newMark > 10) {
            alert("Mark must be a number between 0 and 10.");
            return;
        }

        setSavingMarkFor(responseId);
        try {
            const res = await api.put(`/teacher/responses/${responseId}/marks`, { marks: newMark });
            if (res.data && res.data.status === "success") {
                // Flash a success checkmark
                setSavedMarkMsg(responseId);
                setTimeout(() => setSavedMarkMsg(null), 2000);

                // Refetch to cleanly update overall assignment percentages
                fetchReview();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setSavingMarkFor(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-50">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!reviewData) return null;

    return (
        <div className="max-w-4xl mx-auto p-8 space-y-6">
            <div className="flex justify-between items-center mb-6 border-b pb-6 border-gray-200">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="text-gray-500 hover:text-gray-700 transition-colors p-2 bg-white rounded-full shadow-sm border"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            {reviewData.student_name}'s Submission
                        </h1>
                        <p className="text-gray-500">{reviewData.title}</p>
                    </div>
                </div>
                <div className="bg-white px-6 py-3 rounded-xl shadow-sm border border-blue-100 flex flex-col items-center">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest text-center">Calculated Total</span>
                    <span className="text-3xl font-black text-blue-600 leading-none mt-1">{reviewData.overall_marks}%</span>
                </div>
            </div>

            <div className="space-y-8">
                {reviewData.responses.map((resp: any, idx: number) => (
                    <div key={resp.response_id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

                        {/* Question & Answer Header */}
                        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                            <div className="flex justify-between items-start gap-4 mb-4">
                                <h3 className="text-xl font-bold flex gap-2 text-gray-900">
                                    <span className="text-blue-600 shrink-0">Q{idx + 1}.</span> {resp.question_content}
                                </h3>
                            </div>

                            <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
                                <p className="text-sm font-semibold text-gray-500 uppercase mb-2">Student Answer</p>
                                <p className="text-gray-800 whitespace-pre-wrap">{resp.response_content}</p>
                            </div>

                            <div className="flex flex-col md:flex-row gap-6">
                                <div className="flex-1">
                                    {resp.feedback && (
                                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 h-full">
                                            <p className="text-sm font-semibold text-blue-600 uppercase mb-1">AI Assessor's Feedback</p>
                                            <p className="text-gray-700 italic text-sm">{resp.feedback}</p>
                                        </div>
                                    )}
                                </div>
                                <div className="md:w-64 bg-white p-4 rounded-lg border border-gray-200 shadow-inner flex flex-col justify-center shrink-0">
                                    <label className="text-sm font-semibold text-gray-600 uppercase mb-2 block text-center">Assessed Mark (Max 10)</label>
                                    <div className="flex items-center gap-2 justify-center">
                                        <input
                                            type="number"
                                            min="0" max="10" step="0.5"
                                            value={markEdits[resp.response_id]}
                                            onChange={(e) => setMarkEdits(prev => ({ ...prev, [resp.response_id]: e.target.value }))}
                                            className="w-20 text-center text-2xl font-bold border rounded-lg py-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        />
                                        <span className="text-gray-500 font-bold text-xl">/ 10</span>
                                    </div>
                                    <div className="mt-3 flex justify-center h-8">
                                        {markEdits[resp.response_id] != resp.marks ? (
                                            <button
                                                onClick={() => handleUpdateMark(resp.response_id)}
                                                disabled={savingMarkFor === resp.response_id}
                                                className="text-sm font-bold w-full bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md py-1 transition flex items-center justify-center gap-1"
                                            >
                                                {savingMarkFor === resp.response_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save size={16} /> Save Mark</>}
                                            </button>
                                        ) : savedMarkMsg === resp.response_id ? (
                                            <span className="text-sm font-bold text-green-600 flex items-center justify-center gap-1">
                                                <CheckCircle size={16} /> Saved
                                            </span>
                                        ) : (
                                            <span className="text-sm font-medium text-gray-400">Mark is identical</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Comment Thread */}
                        <div className="p-6 bg-white">
                            <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                Negotiation Thread
                                <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{resp.comments.length}</span>
                            </h4>

                            <div className="space-y-4 mb-6">
                                {resp.comments && resp.comments.length > 0 ? (
                                    resp.comments.map((comment: any) => {
                                        const isMyComment = comment.user_role === 'teacher' || comment.user_role === 'admin';
                                        return (
                                            <div key={comment.id} className={`flex ${isMyComment ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${isMyComment ? 'bg-purple-600 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none'}`}>
                                                    <div className="flex justify-between items-baseline gap-4 mb-1">
                                                        <span className="text-xs font-bold opacity-75">{isMyComment ? 'You' : 'Student'}</span>
                                                        <span className="text-[10px] opacity-60">
                                                            {new Date(comment.created_at).toLocaleDateString()} {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p className="text-sm text-gray-500 italic text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                        No comments yet.
                                    </p>
                                )}
                            </div>

                            {/* Add Comment Input */}
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Reply to student or add a note..."
                                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors"
                                    value={commentTexts[resp.response_id] || ""}
                                    onChange={(e) => setCommentTexts(prev => ({ ...prev, [resp.response_id]: e.target.value }))}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleAddComment(resp.response_id);
                                    }}
                                />
                                <button
                                    onClick={() => handleAddComment(resp.response_id)}
                                    disabled={!commentTexts[resp.response_id]?.trim() || submittingCommentFor === resp.response_id}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                                >
                                    {submittingCommentFor === resp.response_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
