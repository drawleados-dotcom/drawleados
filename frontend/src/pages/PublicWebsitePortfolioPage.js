import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Loader2, Globe, Image as ImageIcon, ExternalLink, CalendarClock } from 'lucide-react';

const API_BASE = `${process.env.REACT_APP_BACKEND_URL}/api`;

const BUDGET_OPTIONS = ['Under ₹25,000', '₹25,000 - ₹50,000', '₹50,000 - ₹1,00,000', '₹1,00,000+'];

const emptyBooking = { name: '', email: '', phone: '', city: '', company: '', budget: '' };

const PublicWebsitePortfolioPage = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [booking, setBooking] = useState(emptyBooking);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    axios.get(`${API_BASE}/sales-kit/public/website-portfolios`)
      .then((res) => { if (!cancelled) setItems(res.data || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const openBooking = () => {
    setBooking(emptyBooking);
    setError('');
    setSubmitted(false);
    setBookingOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!booking.name.trim() || !booking.email.trim() || !booking.phone.trim()) {
      setError('Please enter your name, email and phone number');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await axios.post(`${API_BASE}/sales-kit/public/website-portfolio/book`, booking);
      setSubmitted(true);
    } catch (e) {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-11 w-11 rounded-xl bg-[#3b82f6]/10 mb-3">
            <Globe className="h-5 w-5 text-[#3b82f6]" />
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-1.5">Our Website Portfolio</h1>
          <p className="text-sm md:text-base text-gray-500 max-w-xl mx-auto">
            A look at websites we've built for our clients — business websites, e-commerce stores, and landing pages.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-[#3b82f6]" />
          </div>
        ) : items.length === 0 ? (
          <div className="border border-dashed border-gray-200 rounded-xl p-12 text-center text-sm text-gray-500 bg-white">
            No websites to show yet. Check back soon.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((w) => (
              <div key={w.website_id} className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col" data-testid={`public-website-card-${w.website_id}`}>
                <div className="h-40 bg-gray-100 flex items-center justify-center overflow-hidden">
                  {w.cover_image ? (
                    <img src={w.cover_image} alt={w.website_name} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-gray-300" />
                  )}
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <p className="font-medium text-gray-900">{w.website_name}</p>
                    {w.website_type && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-[#3b82f6]/40 text-[#3b82f6] whitespace-nowrap shrink-0">
                        {w.website_type}
                      </span>
                    )}
                  </div>
                  {w.summary && <p className="text-sm text-gray-500 mb-3 line-clamp-3">{w.summary}</p>}
                  <a
                    href={w.website_link}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-auto inline-flex items-center justify-center gap-1.5 text-sm font-medium text-[#3b82f6] border border-[#3b82f6]/40 rounded-lg py-2 hover:bg-[#3b82f6]/5 transition-colors"
                  >
                    View Website <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 p-3 md:p-4 z-40">
        <div className="max-w-5xl mx-auto">
          <Button
            onClick={openBooking}
            className="w-full bg-[#3b82f6] hover:bg-[#2563eb] py-5 md:py-6 text-sm md:text-base"
            data-testid="book-appointment-btn"
          >
            <CalendarClock className="h-4 w-4 mr-2" /> Book an Appointment to build my website
          </Button>
        </div>
      </div>

      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Book an Appointment</DialogTitle></DialogHeader>
          {submitted ? (
            <div className="text-center py-6">
              <p className="text-gray-900 font-medium mb-1">Thanks, {booking.name.split(' ')[0]}!</p>
              <p className="text-sm text-gray-500">We've received your request and will reach out to you shortly.</p>
              <Button className="mt-4 bg-[#3b82f6] hover:bg-[#2563eb]" onClick={() => setBookingOpen(false)}>Close</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm text-gray-800">Name</Label>
                <Input
                  value={booking.name}
                  onChange={(e) => setBooking(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Your name"
                  autoFocus
                  className="text-gray-900 bg-white placeholder:text-gray-400"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-gray-800">Email</Label>
                <Input
                  type="email"
                  value={booking.email}
                  onChange={(e) => setBooking(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="you@company.com"
                  className="text-gray-900 bg-white placeholder:text-gray-400"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-gray-800">Phone Number</Label>
                <Input
                  type="tel"
                  value={booking.phone}
                  onChange={(e) => setBooking(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Your phone number"
                  className="text-gray-900 bg-white placeholder:text-gray-400"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-gray-800">City</Label>
                <Input
                  value={booking.city}
                  onChange={(e) => setBooking(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="Your city"
                  className="text-gray-900 bg-white placeholder:text-gray-400"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-gray-800">Company</Label>
                <Input
                  value={booking.company}
                  onChange={(e) => setBooking(prev => ({ ...prev, company: e.target.value }))}
                  placeholder="Your company name"
                  className="text-gray-900 bg-white placeholder:text-gray-400"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-gray-800">Budget</Label>
                <Select value={booking.budget} onValueChange={(v) => setBooking(prev => ({ ...prev, budget: v }))}>
                  <SelectTrigger className="text-gray-900 bg-white"><SelectValue placeholder="Select a budget range" /></SelectTrigger>
                  <SelectContent>
                    {BUDGET_OPTIONS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {error && <p className="text-xs text-[#ef4444]">{error}</p>}
              <DialogFooter>
                <Button type="submit" disabled={submitting} className="w-full bg-[#3b82f6] hover:bg-[#2563eb]">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PublicWebsitePortfolioPage;
