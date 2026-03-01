"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2, ArrowLeft, Send } from 'lucide-react';
import api from '@/lib/api';

export default function StudentReviewPage() {
    const router = useRouter();
    const params = useParams();
    const assignmentId = params.assignmentId as string;

    const [reviewData, setReviewData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [commentTexts, setCommentTexts] = useState<Record<number, string>>({});
    const [submittingCommentFor, setSubmittingCommentFor] = useState<number | null>(null);

    useEffect(() => {
        const fetchReview = async () => {
            try {
                const res = await api.get(`/student/assignments/${assignmentId}/review`);
                if (res.data) {
                    setReviewData(res.data);
                }
            } catch (err) {
                console.error(err);
                router.push("/student");
            } finally {
                setIsLoading(false);
            }
        };
        if (assignmentId) fetchReview();
    }, [assignmentId, router]);

    const handleAddComment = async (responseId: number) => {
        const content = commentTexts[responseId]?.trim();
        if (!content) return;

        setSubmittingCommentFor(responseId);
        try {
            const res = await api.post(`/student/responses/${responseId}/comments`, { content });
            if (res.data) {
                // Update local state to inject new comment
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

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-50">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
        );
    }

    if (!reviewData) return null;

    return (
        <div className="max-w-4xl mx-auto p-8 space-y-6">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="text-gray-500 hover:text-gray-700 transition-colors p-2 bg-white rounded-full shadow-sm border"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">
                        {reviewData.title} - Grade Review
                    </h1>
                </div>
                <div className="bg-white px-6 py-2 rounded-full shadow-sm border border-purple-100 flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Total Mark</span>
                    <span className="text-2xl font-black text-purple-600">{reviewData.overall_marks}%</span>
                </div>
            </div>

            {reviewData.overall_feedback && (
                <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Overall Feedback</h3>
                    <p className="text-gray-700 italic leading-relaxed">{reviewData.overall_feedback}</p>
                </div>
            )}

            <div className="space-y-8">
                {reviewData.responses.map((resp: any, idx: number) => (
                    <div key={resp.response_id} className="bg-white rounded-xl shadow-md border-t-4 border-t-purple-500 overflow-hidden">

                        {/* Question & Answer Header */}
                        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                            <div className="flex justify-between items-start gap-4 mb-4">
                                <h3 className="text-xl font-bold flex gap-2 text-gray-900">
                                    <span className="text-purple-600 shrink-0">Q{idx + 1}.</span> {resp.question_content}
                                </h3>
                                <span className={`shrink-0 px-3 py-1 rounded-full text-sm font-bold ${resp.marks >= 8 ? 'bg-green-100 text-green-700' : resp.marks >= 5 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                    {resp.marks} / 10
                                </span>
                            </div>

                            <div className="bg-white p-4 rounded-lg border border-gray-200">
                                <p className="text-sm font-semibold text-gray-500 uppercase mb-2">Your Answer</p>
                                <p className="text-gray-800 whitespace-pre-wrap">{resp.response_content}</p>
                            </div>

                            {resp.feedback && (
                                <div className="mt-4 bg-purple-50 p-4 rounded-lg border border-purple-100">
                                    <p className="text-sm font-semibold text-purple-600 uppercase mb-1">AI Feedback</p>
                                    <p className="text-gray-700 italic text-sm">{resp.feedback}</p>
                                </div>
                            )}
                        </div>

                        {/* Comment Thread */}
                        <div className="p-6 bg-white">
                            <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                Grade Negotiation Thread
                                <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{resp.comments.length}</span>
                            </h4>

                            <div className="space-y-4 mb-6">
                                {resp.comments && resp.comments.length > 0 ? (
                                    resp.comments.map((comment: any) => {
                                        const isMyComment = comment.user_role === 'student' || comment.user_role === 'admin';
                                        return (
                                            <div key={comment.id} className={`flex ${isMyComment ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${isMyComment ? 'bg-purple-600 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none'}`}>
                                                    <div className="flex justify-between items-baseline gap-4 mb-1">
                                                        <span className="text-xs font-bold opacity-75">{isMyComment ? 'You' : 'Teacher'}</span>
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
                                        No comments yet. Request a review below.
                                    </p>
                                )}
                            </div>

                            {/* Add Comment Input */}
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Request a mark adjustment or ask a question..."
                                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-50 focus:bg-white transition-colors"
                                    value={commentTexts[resp.response_id] || ""}
                                    onChange={(e) => setCommentTexts(prev => ({ ...prev, [resp.response_id]: e.target.value }))}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleAddComment(resp.response_id);
                                    }}
                                />
                                <button
                                    onClick={() => handleAddComment(resp.response_id)}
                                    disabled={!commentTexts[resp.response_id]?.trim() || submittingCommentFor === resp.response_id}
                                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                                >
                                    {submittingCommentFor === resp.response_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex justify-center pt-8 border-t">
                <button
                    onClick={() => router.push("/student")}
                    className="bg-gray-900 text-white hover:bg-gray-800 px-8 py-3 rounded-lg font-medium shadow-md transition-colors"
                >
                    Return to Dashboard
                </button>
            </div>
        </div>
    );
}
