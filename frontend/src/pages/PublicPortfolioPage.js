import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Loader2, FileWarning, FileText } from 'lucide-react';

const API_BASE = `${process.env.REACT_APP_BACKEND_URL}/api`;

// This page is only the PRIVATE (lead-gated) portfolio link. The public
// link never renders anything here — it's a plain backend URL that logs a
// click and redirects straight to the portfolio_link server-side.
const PublicPortfolioPage = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [portfolio, setPortfolio] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    axios.get(`${API_BASE}/sales-kit/public/portfolio-private/${token}`)
      .then((res) => { if (!cancelled) setPortfolio(res.data); })
      .catch(() => { if (!cancelled) setNotFound(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError('Please enter your name and email');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE}/sales-kit/public/portfolio-private/${token}/unlock`, {
        name: name.trim(),
        email: email.trim(),
      });
      setRedirecting(true);
      window.location.href = res.data.portfolio_link;
    } catch (e) {
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#3b82f6]" />
      </div>
    );
  }

  if (notFound || !portfolio) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white border border-gray-200 rounded-xl p-8 max-w-md w-full text-center">
          <FileWarning className="h-8 w-8 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-900 font-medium mb-1">Portfolio not available</p>
          <p className="text-sm text-gray-500">This link may have expired or been removed.</p>
        </div>
      </div>
    );
  }

  if (redirecting) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white border border-gray-200 rounded-xl p-8 max-w-md w-full text-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#3b82f6] mx-auto mb-3" />
          <p className="text-gray-900 font-medium">Taking you to the portfolio…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-xl p-6 md:p-8 max-w-md w-full">
        <FileText className="h-9 w-9 text-[#3b82f6] mb-3" />
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Explore our portfolio of Drawlead</h1>
        <p className="text-sm text-gray-500 mb-5">
          {portfolio.service_name}{portfolio.service_type ? ` — ${portfolio.service_type}` : ''}. Enter your name and email to continue.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm text-gray-800">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoFocus
              className="text-gray-900 bg-white placeholder:text-gray-400"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm text-gray-800">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="text-gray-900 bg-white placeholder:text-gray-400"
            />
          </div>
          {error && <p className="text-xs text-[#ef4444]">{error}</p>}
          <Button type="submit" disabled={submitting} className="w-full bg-[#3b82f6] hover:bg-[#2563eb]">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'View Portfolio'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default PublicPortfolioPage;
