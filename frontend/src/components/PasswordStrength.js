import React from 'react';
import { Check, X } from 'lucide-react';

// Password validation rules
export const passwordRules = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'uppercase', label: 'One uppercase letter (A-Z)', test: (p) => /[A-Z]/.test(p) },
  { id: 'lowercase', label: 'One lowercase letter (a-z)', test: (p) => /[a-z]/.test(p) },
  { id: 'number', label: 'One number (0-9)', test: (p) => /[0-9]/.test(p) },
  { id: 'special', label: 'One special character (!@#$%^&*)', test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

// Check if password meets all requirements
export const isPasswordStrong = (password) => {
  return passwordRules.every(rule => rule.test(password));
};

// Get password strength level (0-5)
export const getPasswordStrength = (password) => {
  return passwordRules.filter(rule => rule.test(password)).length;
};

// Get strength label and color
export const getStrengthInfo = (strength) => {
  if (strength === 0) return { label: '', color: '' };
  if (strength === 1) return { label: 'Very Weak', color: 'bg-red-500' };
  if (strength === 2) return { label: 'Weak', color: 'bg-orange-500' };
  if (strength === 3) return { label: 'Fair', color: 'bg-yellow-500' };
  if (strength === 4) return { label: 'Good', color: 'bg-lime-500' };
  return { label: 'Strong', color: 'bg-green-500' };
};

// Password Strength Indicator Component
export default function PasswordStrength({ password, showRules = true }) {
  const strength = getPasswordStrength(password);
  const { label, color } = getStrengthInfo(strength);
  
  if (!password) return null;
  
  return (
    <div className="mt-2 space-y-2">
      {/* Strength Bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-[#27272a] rounded-full overflow-hidden flex gap-0.5">
          {[1, 2, 3, 4, 5].map((level) => (
            <div
              key={level}
              className={`flex-1 h-full rounded-full transition-all ${
                level <= strength ? color : 'bg-[#27272a]'
              }`}
            />
          ))}
        </div>
        <span className={`text-xs font-medium ${
          strength <= 2 ? 'text-red-400' : strength <= 3 ? 'text-yellow-400' : 'text-green-400'
        }`}>
          {label}
        </span>
      </div>
      
      {/* Rules Checklist */}
      {showRules && (
        <div className="grid grid-cols-1 gap-1 text-xs">
          {passwordRules.map((rule) => {
            const passed = rule.test(password);
            return (
              <div key={rule.id} className={`flex items-center gap-1.5 ${passed ? 'text-green-400' : 'text-[#71717a]'}`}>
                {passed ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <X className="h-3 w-3" />
                )}
                <span>{rule.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
