'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import supabase from '../../lib/supabase';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [upcomingBookings, setUpcomingBookings] = useState([]);
  const [pastBookings, setPastBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login?redirect=/dashboard');
        return;
      }
      setUser(session.user);
      return session.user;
    };

    const fetchUserData = async () => {
      try {
        const userData = await checkUser();
        if (!userData) return;

        // Fetch user profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userData.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
          console.error('Error fetching profile:', profileError);
        } else {
          setProfile(profileData);
        }

        // Fetch bookings for the current user
        const { data: bookingsData, error: bookingsError } = await supabase
          .from('bookings')
          .select(`
            *,
            services:\"Service ID\" (*)
          `)
          .eq('Customer Name', userData.email) // Using email to match bookings
          .order('Booking Date', { ascending: true });

        if (bookingsError) {
          throw bookingsError;
        }

        // Process bookings data
        const now = new Date();
        const upcoming = [];
        const past = [];

        bookingsData?.forEach(booking => {
          // Format the booking data to match our application's expected format
          const formattedBooking = {
            id: booking['Booking ID'],
            booking_time: new Date(`${booking['Booking Date']}T${booking['Time Slot (HH:MM)']}`),
            status: 'confirmed', // Default status
            price: booking['Price (INR)'],
            Services: booking.services ? {
              name: booking.services['Service Name'],
              description: booking.services['Description'],
              price: booking.services['Price (INR)'],
              category: booking.services['Category']
            } : null
          };

          // Determine if booking is upcoming or past
          if (formattedBooking.booking_time > now) {
            upcoming.push(formattedBooking);
          } else {
            past.push(formattedBooking);
          }
        });

        setUpcomingBookings(upcoming);
        setPastBookings(past);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load your data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [router]);

  const handleCancelBooking = async (bookingId) => {
    try {
      // Since we don't have a status field in the database,
      // we'll just remove the booking instead of updating its status
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('Booking ID', bookingId);

      if (error) {
        throw error;
      }

      // Update the local state by removing the cancelled booking
      setUpcomingBookings(upcomingBookings.filter(booking => booking.id !== bookingId));
    } catch (error) {
      console.error('Error cancelling booking:', error);
      setError('Failed to cancel booking. Please try again.');
    }
  };

  const formatDate = (dateString) => {
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="sr-only">Loading...</span>
          </div>
          <p className="mt-2">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-8">
          <div className="px-6 py-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome, {profile?.full_name || user?.email}</h1>
            <p className="text-gray-600">Manage your spa appointments and view your booking history</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar with user info */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-8">
              <div className="px-6 py-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Your Information</h2>
                <div className="space-y-3">
                  <p className="text-gray-600">
                    <span className="font-semibold">Email:</span> {user?.email}
                  </p>
                  {profile?.phone && (
                    <p className="text-gray-600">
                      <span className="font-semibold">Phone:</span> {profile.phone}
                    </p>
                  )}
                </div>
                <div className="mt-6">
                  <Link href="/profile" className="btn-secondary w-full text-center block">
                    Edit Profile
                  </Link>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="px-6 py-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
                <div className="space-y-3">
                  <Link href="/booking" className="btn-primary w-full text-center block">
                    Book New Appointment
                  </Link>
                  <Link href="/services" className="btn-secondary w-full text-center block">
                    View Services
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Upcoming Bookings */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="px-6 py-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Upcoming Appointments</h2>
                
                {upcomingBookings.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">You don't have any upcoming appointments.</p>
                    <Link href="/booking" className="mt-4 inline-block btn-primary">
                      Book an Appointment
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {upcomingBookings.map((booking) => (
                      <div key={booking.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-bold text-lg">{booking.Services?.name || 'Service'}</h3>
                            <p className="text-gray-600">{formatDate(booking.booking_time)}</p>
                            <div className="mt-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                booking.status === 'confirmed' 
                                  ? 'bg-green-100 text-green-800' 
                                  : booking.status === 'cancelled'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                              </span>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            {booking.status === 'confirmed' && (
                              <button
                                onClick={() => handleCancelBooking(booking.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                Cancel
                              </button>
                            )}
                            <Link
                              href={`/booking/${booking.id}`}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              Details
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Past Bookings */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="px-6 py-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Booking History</h2>
                
                {pastBookings.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">You don't have any past appointments.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {pastBookings.map((booking) => (
                      <div key={booking.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-bold text-lg">{booking.Services?.name || 'Service'}</h3>
                            <p className="text-gray-600">{formatDate(booking.booking_time)}</p>
                            <div className="mt-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                booking.status === 'completed' 
                                  ? 'bg-green-100 text-green-800' 
                                  : booking.status === 'cancelled'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                              </span>
                            </div>
                          </div>
                          <Link
                            href={`/booking/${booking.id}`}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            Details
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}