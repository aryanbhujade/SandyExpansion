import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Save, User, MapPin, Briefcase, Tag, Award, BookOpen, FileText } from 'lucide-react';
import { employeeApi } from '@/services/api';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  onProfileUpdated?: () => void;
}

export default function ProfileModal({ isOpen, onClose, employeeId, onProfileUpdated }: ProfileModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [level, setLevel] = useState('');
  const [businessUnit, setBusinessUnit] = useState('');
  
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [skills, setSkills] = useState('');
  const [projects, setProjects] = useState('');
  const [expertise, setExpertise] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isOpen || !employeeId) return;

    const fetchProfile = async () => {
      setLoading(true);
      setError('');
      setSuccess(false);
      try {
        const data = await employeeApi.getFullProfile(employeeId);
        setName(data.name || '');
        setEmail(data.email || '');
        setLevel(data.level || '');
        setBusinessUnit(data.business_unit || '');
        setRole(data.role || '');
        setDepartment(data.department || '');
        setLocation(data.location || '');
        setSkills((data.skills || []).join(', '));
        setProjects((data.projects || []).join(', '));
        setExpertise((data.expertise_topics || []).join(', '));
        setNotes(data.notes || '');
      } catch (err: any) {
        console.error('Error fetching profile:', err);
        setError('Failed to load profile details. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    void fetchProfile();
  }, [isOpen, employeeId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);

    // Convert comma-separated string lists into array of trimmed strings
    const parseList = (str: string) => 
      str.split(',')
         .map(item => item.trim())
         .filter(item => item.length > 0);

    const payload = {
      role: role.trim() || undefined,
      department: department.trim() || undefined,
      location: location.trim() || undefined,
      skills: parseList(skills),
      projects: parseList(projects),
      expertise_topics: parseList(expertise),
      notes: notes.trim() || undefined,
    };

    try {
      await employeeApi.updateProfile(payload);
      setSuccess(true);
      if (onProfileUpdated) {
        onProfileUpdated();
      }
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative z-10 flex h-full max-h-[85vh] w-full max-w-[650px] flex-col rounded-[32px] border border-white/10 bg-[#121213]/95 text-white shadow-[0_25px_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/8 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">Edit Profile</h3>
                  <p className="text-xs text-zinc-400">Update your professional details and expertise</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl text-zinc-400 hover:bg-white/10 hover:text-white"
                onClick={onClose}
                type="button"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {loading ? (
                <div className="flex min-h-[30vh] flex-col items-center justify-center text-zinc-400 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                  <span className="text-sm">Fetching profile details...</span>
                </div>
              ) : (
                <form id="profile-form" onSubmit={handleSave} className="space-y-6">
                  {/* Read Only Account section */}
                  <div className="rounded-2xl border border-white/6 bg-white/[0.02] p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-xs text-zinc-500 block uppercase tracking-wider">Full Name</span>
                        <span className="font-medium text-zinc-200 mt-1 block">{name}</span>
                      </div>
                      <div>
                        <span className="text-xs text-zinc-500 block uppercase tracking-wider">Email Address</span>
                        <span className="font-medium text-zinc-200 mt-1 block truncate">{email}</span>
                      </div>
                      <div>
                        <span className="text-xs text-zinc-500 block uppercase tracking-wider">Level</span>
                        <span className="inline-block rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300 mt-1">
                          {level}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-zinc-500 block uppercase tracking-wider">Business Unit</span>
                        <span className="font-medium text-zinc-200 mt-1 block">{businessUnit || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-sm text-rose-300">
                      {error}
                    </div>
                  )}

                  {success && (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-sm text-emerald-300">
                      Profile saved successfully! Closing...
                    </div>
                  )}

                  {/* Form fields */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                          <Briefcase className="h-3.5 w-3.5 text-zinc-400" />
                          Role / Designation
                        </label>
                        <Input
                          type="text"
                          value={role}
                          onChange={(e) => setRole(e.target.value)}
                          placeholder="e.g. Senior Software Engineer"
                          className="h-10 rounded-xl border-white/8 bg-white/[0.02] text-sm text-white focus:border-emerald-500/40 focus:ring-emerald-500/20"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                          <Award className="h-3.5 w-3.5 text-zinc-400" />
                          Department
                        </label>
                        <Input
                          type="text"
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          placeholder="e.g. Engineering"
                          className="h-10 rounded-xl border-white/8 bg-white/[0.02] text-sm text-white focus:border-emerald-500/40 focus:ring-emerald-500/20"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-zinc-400" />
                        Location
                      </label>
                      <Input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="e.g. New York, USA"
                        className="h-10 rounded-xl border-white/8 bg-white/[0.02] text-sm text-white focus:border-emerald-500/40 focus:ring-emerald-500/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5 text-zinc-400" />
                        Skills (comma separated)
                      </label>
                      <Input
                        type="text"
                        value={skills}
                        onChange={(e) => setSkills(e.target.value)}
                        placeholder="e.g. React, TypeScript, Python, Node.js"
                        className="h-10 rounded-xl border-white/8 bg-white/[0.02] text-sm text-white focus:border-emerald-500/40 focus:ring-emerald-500/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-zinc-400" />
                        Projects (comma separated)
                      </label>
                      <Input
                        type="text"
                        value={projects}
                        onChange={(e) => setProjects(e.target.value)}
                        placeholder="e.g. Alpha Portal, Sandy Bot, Data Engine"
                        className="h-10 rounded-xl border-white/8 bg-white/[0.02] text-sm text-white focus:border-emerald-500/40 focus:ring-emerald-500/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-zinc-400" />
                        Expertise/Interests (comma separated)
                      </label>
                      <Input
                        type="text"
                        value={expertise}
                        onChange={(e) => setExpertise(e.target.value)}
                        placeholder="e.g. Cloud Architecture, Machine Learning, UI/UX"
                        className="h-10 rounded-xl border-white/8 bg-white/[0.02] text-sm text-white focus:border-emerald-500/40 focus:ring-emerald-500/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-zinc-400" />
                        Bio / Experience Notes
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Tell colleagues about your experience, interests, or how you can help..."
                        rows={4}
                        className="w-full rounded-xl border border-white/8 bg-white/[0.02] p-3 text-sm text-white focus:border-emerald-500/40 focus:ring-emerald-500/20 focus:outline-none focus:ring-2"
                      />
                    </div>
                  </div>
                </form>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-white/8 px-6 py-4">
              <Button
                variant="ghost"
                type="button"
                className="h-10 rounded-xl text-zinc-400 hover:bg-white/10 hover:text-white"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                form="profile-form"
                type="submit"
                disabled={loading || saving || success}
                className="h-10 rounded-xl bg-white px-4 text-xs font-semibold text-black hover:bg-zinc-200 disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
