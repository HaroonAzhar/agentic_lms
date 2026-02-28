"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';

interface Question {
    id: number;
    content: string;
}

interface Assignment {
    id: number;
    title: string;
    questions: Question[];
}

export default function StudentAssignmentPage() {
    const [assignment, setAssignment] = useState<Assignment | null>(null);
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<any>(null);

    const router = useRouter();
    const params = useParams();
    const assignmentId = params.assignmentId as string;

    useEffect(() => {
        const fetchAssignment = async () => {
            try {
                const res = await api.get(`/student/assignments/${assignmentId}`);
                if (res.data) {
                    setAssignment(res.data);
                } else {
                    console.error("Failed to load assignment");
                    router.push("/student");
                }
            } catch (err) {
                console.error(err);
                router.push("/student");
            } finally {
                setIsLoading(false);
            }
        };
        if (assignmentId) fetchAssignment();
    }, [assignmentId, router]);

    const handleSubmit = async () => {
        if (!assignment) return;
        setIsSubmitting(true);

        const responses = Object.entries(answers).map(([qId, ans]) => ({
            question_id: parseInt(qId),
            answer: ans
        }));

        try {
            const res = await api.post(`/student/assignments/${assignment.id}/submit`, { responses });
            if (res.data) {
                setResult(res.data);
            } else {
                console.error("Submission failed");
            }
        } catch (err) {
            console.error("Submit error", err);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-50">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
        );
    }

    if (!assignment) return null;

    return (
        <div className="max-w-4xl mx-auto p-8 space-y-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">
                    {assignment.title}
                </h1>
                <button
                    className="px-4 py-2 border rounded-md hover:bg-gray-50 transition-colors shadow-sm bg-white"
                    onClick={() => router.back()}
                >
                    Cancel
                </button>
            </div>

            {!result ? (
                <div className="space-y-6">
                    {assignment.questions.map((q, idx) => (
                        <div key={q.id} className="border-t-4 border-t-purple-500 shadow-md bg-white rounded-lg p-6">
                            <h3 className="text-xl font-bold mb-4 flex gap-2">
                                <span className="text-purple-600">Q{idx + 1}.</span> {q.content}
                            </h3>
                            <textarea
                                placeholder="Write your answer here..."
                                rows={4}
                                className="w-full p-3 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 transition-shadow bg-gray-50 focus:bg-white"
                                value={answers[q.id] || ''}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                            />
                        </div>
                    ))}

                    <div className="flex justify-end pt-4">
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting || Object.keys(answers).length === 0}
                            className="bg-purple-600 text-white hover:bg-purple-700 font-semibold text-lg px-8 py-3 rounded-lg w-full md:w-auto disabled:opacity-50 flex justify-center items-center shadow-md transition-colors"
                        >
                            {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Grading in Progress...</> : "Submit Assignment"}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="border-t-4 border-t-green-500 shadow-lg bg-white rounded-lg overflow-hidden">
                    <div className="bg-green-50/50 p-6 border-b border-green-100 flex items-center justify-center">
                        <h2 className="text-2xl font-bold text-green-700">Submission Graded Successfully</h2>
                    </div>
                    <div className="p-8 space-y-8">
                        <div className="flex justify-around items-center bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                            <div className="text-center">
                                <p className="text-sm uppercase tracking-wider text-gray-500 font-semibold mb-1">Status</p>
                                <p className="text-lg font-medium text-gray-800 capitalize">{result.status}</p>
                            </div>
                            <div className="h-10 w-px bg-gray-200" />
                            <div className="text-center">
                                <p className="text-sm uppercase tracking-wider text-gray-500 font-semibold mb-1">Overall Mark</p>
                                <p className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-400 bg-clip-text text-transparent">{result.marks}%</p>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xl font-semibold mb-3">Overall Feedback</h3>
                            <div className="bg-gray-50 p-5 rounded-lg border border-gray-100 italic text-gray-700 whitespace-pre-wrap leading-relaxed">
                                {result.feedback || "No overall feedback provided."}
                            </div>
                        </div>

                        {result.question_scores && result.question_scores.length > 0 && (
                            <div>
                                <h3 className="text-xl font-semibold mb-3">Question Feedback</h3>
                                <div className="space-y-4">
                                    {result.question_scores.map((qs: any, idx: number) => (
                                        <div key={idx} className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                                            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-2 gap-2">
                                                <span className="font-semibold text-gray-800">Question {idx + 1}</span>
                                                <span className={`px-3 py-1 rounded-full text-sm font-bold w-fit ${qs.marks >= 8 ? 'bg-green-100 text-green-700' : qs.marks >= 5 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                                    {qs.marks} / 10
                                                </span>
                                            </div>
                                            <p className="text-gray-600 text-sm italic mt-1 leading-relaxed">
                                                {qs.feedback || "No specific feedback provided for this question."}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {result.topic_scores && result.topic_scores.length > 0 && (
                            <div>
                                <h3 className="text-xl font-semibold mb-3">Topic Breakdown</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {result.topic_scores.map((ts: any, idx: number) => (
                                        <div key={idx} className="flex justify-between items-start gap-4 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                                            <div>
                                                <span className="font-semibold text-gray-800 block">Topic #{ts.topic_id}</span>
                                                {ts.feedback && <p className="text-xs text-gray-500 mt-1 italic">{ts.feedback}</p>}
                                            </div>
                                            <span className={`shrink-0 px-3 py-1 rounded-full text-sm font-bold ${ts.marks >= 8 ? 'bg-green-100 text-green-700' : ts.marks >= 5 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                                {ts.marks} / 10
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-center pt-6 border-t">
                            <button
                                onClick={() => router.push("/student")}
                                className="bg-gray-900 text-white hover:bg-gray-800 px-8 py-3 rounded-lg font-medium shadow-md transition-colors"
                            >
                                Return to Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
