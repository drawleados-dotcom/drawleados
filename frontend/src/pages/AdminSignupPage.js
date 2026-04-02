import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Shield, Eye, EyeOff, ArrowLeft, Check } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminSignupPage = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    adminCode: ''
  });

  const [errors, setErrors] = useState({});

  // Theme classes
  const bgMain = isDark ? 'bg-[#09090b]' : 'bg-gray-50';
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgInput = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  const borderColor = isDark ? 'border-[#3f3f46]' : 'border-gray-200';

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.adminCode.trim()) {
      newErrors.adminCode = 'Admin code is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    try {
      const response = await axios.post(`${API}/api/auth/admin-signup`, {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        admin_code: formData.adminCode
      });

      if (response.data.user) {
        setSuccess(true);
        toast.success('Admin account created successfully!');
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to create admin account';
      toast.error(message);
      if (message.includes('code')) {
        setErrors({ ...errors, adminCode: message });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  if (success) {
    return (
      <div className={`min-h-screen ${bgMain} flex items-center justify-center p-4`}>
        <Card className={`${bgCard} border ${borderColor} w-full max-w-md text-center`}>
          <CardContent className="pt-8 pb-8">
            <div className="h-16 w-16 rounded-full bg-[#22c55e]/20 flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-[#22c55e]" />
            </div>
            <h2 className={`text-2xl font-bold ${textPrimary} mb-2`}>Account Created!</h2>
            <p className={`${textSecondary} mb-4`}>
              Your admin account has been created successfully.
            </p>
            <p className={`${textSecondary} text-sm`}>
              Redirecting to login...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bgMain} flex items-center justify-center p-4`}>
      <div className="w-full max-w-md">
        {/* Back to Login */}
        <Link 
          to="/login" 
          className={`inline-flex items-center gap-2 ${textSecondary} hover:${textPrimary} mb-6 transition-colors`}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Login
        </Link>

        <Card className={`${bgCard} border ${borderColor}`}>
          <CardHeader className="text-center pb-2">
            <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center mx-auto mb-4">
              <Shield className="h-7 w-7 text-white" />
            </div>
            <CardTitle className={`text-2xl font-bold ${textPrimary}`}>
              Admin Signup
            </CardTitle>
            <CardDescription className={textSecondary}>
              Create a new administrator account
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div className="space-y-2">
                <Label className={textPrimary}>Full Name</Label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Enter your full name"
                  className={`${bgInput} border ${borderColor} ${textPrimary} ${errors.name ? 'border-red-500' : ''}`}
                />
                {errors.name && <p className="text-red-500 text-xs">{errors.name}</p>}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label className={textPrimary}>Email Address</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="admin@company.com"
                  className={`${bgInput} border ${borderColor} ${textPrimary} ${errors.email ? 'border-red-500' : ''}`}
                />
                {errors.email && <p className="text-red-500 text-xs">{errors.email}</p>}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label className={textPrimary}>Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    placeholder="Create a strong password"
                    className={`${bgInput} border ${borderColor} ${textPrimary} pr-10 ${errors.password ? 'border-red-500' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 ${textSecondary}`}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-red-500 text-xs">{errors.password}</p>}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label className={textPrimary}>Confirm Password</Label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => handleChange('confirmPassword', e.target.value)}
                    placeholder="Confirm your password"
                    className={`${bgInput} border ${borderColor} ${textPrimary} pr-10 ${errors.confirmPassword ? 'border-red-500' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 ${textSecondary}`}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-red-500 text-xs">{errors.confirmPassword}</p>}
              </div>

              {/* Admin Code */}
              <div className="space-y-2">
                <Label className={textPrimary}>Admin Access Code</Label>
                <Input
                  type="password"
                  value={formData.adminCode}
                  onChange={(e) => handleChange('adminCode', e.target.value)}
                  placeholder="Enter admin access code"
                  className={`${bgInput} border ${borderColor} ${textPrimary} ${errors.adminCode ? 'border-red-500' : ''}`}
                />
                {errors.adminCode && <p className="text-red-500 text-xs">{errors.adminCode}</p>}
                <p className={`text-xs ${textSecondary}`}>
                  Contact your system administrator for the access code
                </p>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] hover:from-[#4f46e5] hover:to-[#7c3aed] text-white py-6 mt-6"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating Account...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Create Admin Account
                  </span>
                )}
              </Button>
            </form>

            {/* Login Link */}
            <div className="mt-6 text-center">
              <p className={textSecondary}>
                Already have an account?{' '}
                <Link to="/login" className="text-[#6366f1] hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className={`text-center ${textSecondary} text-xs mt-6`}>
          Protected by Drawlead OS Security
        </p>
      </div>
    </div>
  );
};

export default AdminSignupPage;
