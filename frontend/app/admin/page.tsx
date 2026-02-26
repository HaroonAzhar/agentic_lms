'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Plus, Trash2, Users, BookOpen, X, Lock } from 'lucide-react';

interface User {
    id: number;
    username: string;
    role: string;
}

interface Class {
    id: number;
    name: string;
    course_name: string;
    teacher_id?: number;
}

export default function AdminDashboard() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [activeTab, setActiveTab] = useState<'users' | 'classes'>('users');

    // Data State
    const [users, setUsers] = useState<User[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [showUserModal, setShowUserModal] = useState(false);
    const [showClassModal, setShowClassModal] = useState(false);

    // Form State
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'student' });
    const [newClass, setNewClass] = useState({ name: '', course_name: '', teacher_id: '' });

    // Enrollment Modal State
    const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
    const [selectedClass, setSelectedClass] = useState<Class | null>(null);
    const [enrolledStudents, setEnrolledStudents] = useState<User[]>([]);
    const [studentIdToEnroll, setStudentIdToEnroll] = useState('');

    useEffect(() => {
        fetchInitialData();
    }, [router]);

    const fetchInitialData = async () => {
        try {
            const userRes = await api.get('/auth/users/me');
            if (userRes.data.role !== 'admin') {
                router.push('/login');
                return;
            }
            setUser(userRes.data);

            const [usersData, classesData] = await Promise.all([
                api.get('/admin/users'),
                api.get('/admin/classes')
            ]);

            setUsers(usersData.data);
            setClasses(classesData.data);
        } catch (err) {
            console.error(err);
            router.push('/login');
        } finally {
            setLoading(false);
        }
    };

    // Edit State
    const [isEditingUser, setIsEditingUser] = useState(false);
    const [editUserId, setEditUserId] = useState<number | null>(null);

    const openEditUserModal = (user: User) => {
        setIsEditingUser(true);
        setEditUserId(user.id);
        setNewUser({ username: user.username, password: '', role: user.role });
        setShowUserModal(true);
    };

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (isEditingUser && editUserId) {
                const payload: any = {
                    username: newUser.username,
                    role: newUser.role
                };
                if (newUser.password) {
                    payload.password = newUser.password;
                }
                const res = await api.put(`/admin/users/${editUserId}`, payload);
                setUsers(users.map(u => u.id === editUserId ? res.data : u));
            } else {
                const res = await api.post('/admin/users', {
                    username: newUser.username,
                    password_hash: newUser.password,
                    role: newUser.role
                });
                setUsers([...users, res.data]);
            }
            setShowUserModal(false);
            setNewUser({ username: '', password: '', role: 'student' });
            setIsEditingUser(false);
            setEditUserId(null);
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Failed to save user');
        }
    };


    const handleDeleteUser = async (id: number) => {
        if (!confirm('Are you sure you want to delete this user?')) return;
        try {
            await api.delete(`/admin/users/${id}`);
            setUsers(users.filter(u => u.id !== id));
        } catch (err) {
            alert('Failed to delete user');
        }
    };

    const handleCreateClass = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload: any = {
                name: newClass.name,
                course_name: newClass.course_name,
            };
            if (newClass.teacher_id) {
                payload.teacher_id = parseInt(newClass.teacher_id);
            }

            const res = await api.post('/admin/classes', payload);
            setClasses([...classes, res.data]);
            setShowClassModal(false);
            setNewClass({ name: '', course_name: '', teacher_id: '' });
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Failed to create class');
        }
    };

    const handleDeleteClass = async (id: number) => {
        if (!confirm('Are you sure you want to delete this class?')) return;
        try {
            await api.delete(`/admin/classes/${id}`);
            setClasses(classes.filter(c => c.id !== id));
        } catch (err) {
            alert('Failed to delete class');
        }
    };

    const openEnrollmentModal = async (cls: Class) => {
        setSelectedClass(cls);
        setShowEnrollmentModal(true);
        try {
            const res = await api.get(`/admin/classes/${cls.id}/students`);
            setEnrolledStudents(res.data);
        } catch (err) {
            alert('Failed to fetch enrolled students');
        }
    };

    const handleEnrollStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClass) return;
        try {
            await api.post(`/admin/classes/${selectedClass.id}/enroll?student_id=${studentIdToEnroll}`);
            // Refresh list
            const res = await api.get(`/admin/classes/${selectedClass.id}/students`);
            setEnrolledStudents(res.data);
            setStudentIdToEnroll('');
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Failed to enroll student');
        }
    };

    const handleUnenrollStudent = async (studentId: number) => {
        if (!selectedClass) return;
        if (!confirm('Remove this student from class?')) return;
        try {
            await api.delete(`/admin/classes/${selectedClass.id}/enroll/${studentId}`);
            setEnrolledStudents(enrolledStudents.filter(s => s.id !== studentId));
        } catch (err) {
            alert('Failed to unenroll student');
        }
    };

    if (loading) return <div className="p-8 flex justify-center text-gray-500">Loading Dashboard...</div>;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Navbar */}
            <nav className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Lock className="w-5 h-5 text-blue-600" />
                            Admin Portal
                        </h1>
                        <div className="flex items-center gap-4">
                            <span className="text-gray-600">Welcome, {user?.username}</span>
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
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Tabs */}
                <div className="flex space-x-1 mb-6 bg-white p-1 rounded-lg shadow-sm w-fit">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'users'
                            ? 'bg-blue-100 text-blue-700'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                            }`}
                    >
                        <Users size={18} />
                        User Management
                    </button>
                    <button
                        onClick={() => setActiveTab('classes')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'classes'
                            ? 'bg-blue-100 text-blue-700'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                            }`}
                    >
                        <BookOpen size={18} />
                        Class Management
                    </button>
                </div>

                {/* Users Tab */}
                {activeTab === 'users' && (
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-lg font-semibold text-gray-900">Registered Users</h2>
                            <button
                                onClick={() => {
                                    setNewUser({ username: '', password: '', role: 'student' });
                                    setIsEditingUser(false);
                                    setEditUserId(null);
                                    setShowUserModal(true);
                                }}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm transition-colors"
                            >
                                <Plus size={16} />
                                Add User
                            </button>
                        </div>
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {users.map((u) => (
                                    <tr key={u.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.id}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{u.username}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                                                u.role === 'teacher' ? 'bg-green-100 text-green-800' :
                                                    'bg-blue-100 text-blue-800'
                                                }`}>
                                                {u.role.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button onClick={() => openEditUserModal(u)} className="text-blue-500 hover:text-blue-700 mr-2">
                                                <Users size={18} />
                                            </button>
                                            <button onClick={() => handleDeleteUser(u.id)} className="text-red-500 hover:text-red-700">
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Classes Tab */}
                {activeTab === 'classes' && (
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-lg font-semibold text-gray-900">Active Classes</h2>
                            <button
                                onClick={() => setShowClassModal(true)}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm transition-colors"
                            >
                                <Plus size={16} />
                                Add Class
                            </button>
                        </div>
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course Code</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teacher ID</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {classes.map((c) => (
                                    <tr key={c.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c.id}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{c.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c.course_name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c.teacher_id || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button onClick={() => handleDeleteClass(c.id)} className="text-red-500 hover:text-red-700">
                                                <Trash2 size={18} />
                                            </button>
                                            <button onClick={() => openEnrollmentModal(c)} className="ml-2 text-blue-500 hover:text-blue-700">
                                                <Users size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* User Modal */}
                {showUserModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-gray-900">{isEditingUser ? 'Edit User' : 'Add New User'}</h3>
                                <button onClick={() => setShowUserModal(false)} className="text-gray-400 hover:text-gray-600">
                                    <X size={24} />
                                </button>
                            </div>
                            <form onSubmit={handleSaveUser} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-3 py-2 border rounded-md"
                                        value={newUser.username}
                                        onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Password {isEditingUser && <span className="text-xs text-gray-500 font-normal">(Leave blank to keep unchanged)</span>}
                                    </label>
                                    <input
                                        type="password"
                                        required={!isEditingUser}
                                        className="w-full px-3 py-2 border rounded-md"
                                        value={newUser.password}
                                        onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                                    <select
                                        className="w-full px-3 py-2 border rounded-md"
                                        value={newUser.role}
                                        onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                                    >
                                        <option value="student">Student</option>
                                        <option value="teacher">Teacher</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                                <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700">
                                    {isEditingUser ? 'Update User' : 'Create User'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* Class Modal */}
                {showClassModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-gray-900">Add New Class</h3>
                                <button onClick={() => setShowClassModal(false)} className="text-gray-400 hover:text-gray-600">
                                    <X size={24} />
                                </button>
                            </div>
                            <form onSubmit={handleCreateClass} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Class Name</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Intro to AI"
                                        className="w-full px-3 py-2 border rounded-md"
                                        value={newClass.name}
                                        onChange={e => setNewClass({ ...newClass, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Course Code</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. CS101"
                                        className="w-full px-3 py-2 border rounded-md"
                                        value={newClass.course_name}
                                        onChange={e => setNewClass({ ...newClass, course_name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Teacher ID (Optional)</label>
                                    <input
                                        type="number"
                                        placeholder="Enter Teacher User ID"
                                        className="w-full px-3 py-2 border rounded-md"
                                        value={newClass.teacher_id}
                                        onChange={e => setNewClass({ ...newClass, teacher_id: e.target.value })}
                                    />
                                </div>
                                <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700">
                                    Create Class
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* Enrollment Modal */}
                {showEnrollmentModal && selectedClass && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-gray-900">Manage Students - {selectedClass.name}</h3>
                                <button onClick={() => setShowEnrollmentModal(false)} className="text-gray-400 hover:text-gray-600">
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Add Student Form */}
                            <form onSubmit={handleEnrollStudent} className="flex gap-4 mb-8 bg-gray-50 p-4 rounded-lg">
                                <input
                                    type="number"
                                    placeholder="Student ID"
                                    required
                                    className="flex-1 px-3 py-2 border rounded-md"
                                    value={studentIdToEnroll}
                                    onChange={e => setStudentIdToEnroll(e.target.value)}
                                />
                                <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">
                                    Add Student
                                </button>
                            </form>

                            {/* Enrolled Students List */}
                            <div>
                                <h4 className="font-semibold mb-4">Enrolled Students</h4>
                                <div className="max-h-60 overflow-y-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {enrolledStudents.map((s) => (
                                                <tr key={s.id}>
                                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{s.id}</td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{s.username}</td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-right text-sm">
                                                        <button
                                                            onClick={() => handleUnenrollStudent(s.id)}
                                                            className="text-red-500 hover:text-red-700"
                                                        >
                                                            Remove
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {enrolledStudents.length === 0 && (
                                                <tr>
                                                    <td colSpan={3} className="px-4 py-4 text-center text-gray-500 text-sm">
                                                        No students enrolled yet.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
}
