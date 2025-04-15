'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import supabase from '../../lib/supabase';

export default function Booking() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preSelectedServiceId = searchParams.get('service');

  const [user, setUser] = useState(null);
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(preSelectedServiceId || '');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState('');
  const [availableTimes, setAvailableTimes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Time slots from 9 AM to 7 PM (last appointment at 6 PM)
  const generateTimeSlots = () => {
    const slots = [];
    // Generate 1-hour slots from 9 AM to 6 PM (last appointment ends at 7 PM)
    for (let hour = 9; hour <= 18; hour++) {
      const formattedHour = hour % 12 === 0 ? 12 : hour % 12;
      const amPm = hour < 12 ? 'AM' : 'PM';
      slots.push(`${formattedHour}:00 ${amPm}`);
    }
    return slots;
  };

  useEffect(() => {
    // Check user(login)
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Redirect to login if not authenticated
        router.push('/login?redirect=/booking');
        return;
      }
      setUser(session.user);
    };

    // Fetch services
    const fetchServices = async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*');

      if (error) {
        console.error('Error fetching services:', error);
        setError('Failed to load services. Please try again later.');
      } else {
        // Map the data to match our application's expected format
        const formattedServices = data?.map(service => ({
          id: service['Service ID'],
          name: service['Service Name'],
          description: service['Description'],
          price: service['Price (INR)'],
          category: service['Category']
        })) || [];

        setServices(formattedServices);

        // If a service was pre-selected and exists in the fetched services
        if (preSelectedServiceId && formattedServices.length > 0) {
          const serviceExists = formattedServices.some(service => service.id.toString() === preSelectedServiceId);
          if (serviceExists) {
            setSelectedService(preSelectedServiceId);
          }
        }
      }
      setLoading(false);
    };

    checkUser();
    fetchServices();
  }, [router, preSelectedServiceId]);

  useEffect(() => {
    const fetchAvailableTimeSlots = async () => {
      if (!selectedDate) return;

      try {
        // Format the selected date to YYYY-MM-DD for database query
        const formattedDate = selectedDate.toISOString().split('T')[0];

        // Get all time slots
        const allTimeSlots = generateTimeSlots();

        // Fetch existing bookings for the selected date
        const { data: existingBookings, error } = await supabase
          .from('bookings')
          .select('*')
          .eq('Booking Date', formattedDate);

        if (error) {
          console.error('Error fetching existing bookings:', error);
          setAvailableTimes(allTimeSlots); // Show all slots if there's an error
          return;
        }

        // Convert existing booking times to a format we can compare with
        const bookedTimes = new Set();

        existingBookings?.forEach(booking => {
          // Extract hour and minute from the time slot
          const timeSlot = booking['Time Slot (HH:MM)'];
          if (timeSlot) {
            const [hour, minute] = timeSlot.split(':').map(Number);

            // Convert to 12-hour format with AM/PM
            let formattedHour = hour % 12;
            formattedHour = formattedHour === 0 ? 12 : formattedHour;
            const amPm = hour < 12 ? 'AM' : 'PM';

            // Format to match our time slot format
            const formattedTime = `${formattedHour}:00 ${amPm}`;
            bookedTimes.add(formattedTime);
          }
        });

        console.log('Booked times:', [...bookedTimes]);

        // Filter out booked time slots
        const availableSlots = allTimeSlots.filter(slot => !bookedTimes.has(slot));

        console.log('Available slots:', availableSlots);
        setAvailableTimes(availableSlots);
      } catch (error) {
        console.error('Error processing time slots:', error);
        setAvailableTimes(generateTimeSlots()); // Show all slots if there's an error
      }
    };

    fetchAvailableTimeSlots();
  }, [selectedDate]);

  const handleBooking = async (e) => {
    e.preventDefault();
    
    if (!selectedService || !selectedDate || !selectedTime) {
      setError('Please select a service, date, and time.');
      return;
    }

    setBookingLoading(true);
    setError(null);

    try {
      // Format the date and time for database
      const bookingDateTime = new Date(selectedDate);

      // Parse the time from format like "9:00 AM" or "3:00 PM"
      // Extract just the time part (before the dash if there is one)
      const timeOnly = selectedTime.split(' - ')[0];
      const [hourMinute, ampm] = timeOnly.split(' ');
      const [hours, minutes] = hourMinute.split(':');
      const isPM = ampm === 'PM';
      let hour = parseInt(hours);

      if (isPM && hour !== 12) {
        hour += 12;
      } else if (!isPM && hour === 12) {
        hour = 0;
      }

      bookingDateTime.setHours(hour, parseInt(minutes), 0, 0);

      // Format the date and time for the database
      const formattedDate = bookingDateTime.toISOString().split('T')[0]; // YYYY-MM-DD
      const formattedTime = `${bookingDateTime.getHours()}:${bookingDateTime.getMinutes().toString().padStart(2, '0')}`;

      // Get the service price
      const selectedServiceObj = services.find(s => s.id.toString() === selectedService.toString());
      const servicePrice = selectedServiceObj?.price || 0;

      // Create booking in database
      const { data, error } = await supabase
        .from('bookings')
        .insert([
          {
            "Customer Name": user.email, // Using email as customer name for now
            "Service ID": parseInt(selectedService),
            "Booking Date": formattedDate,
            "Time Slot (HH:MM)": formattedTime,
            "Price (INR)": servicePrice
          },
        ]);

      if (error) {
        throw error;
      }

      setSuccess(true);
      // Reset form
      setSelectedService(preSelectedServiceId || '');
      setSelectedDate(new Date());
      setSelectedTime('');
      
      // Redirect to confirmation page
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (error) {
      console.error('Booking error:', error);
      setError('Failed to create booking. Please try again.');
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="sr-only">Loading...</span>
          </div>
          <p className="mt-2">Loading booking information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-8 sm:p-10">
            <div className="text-center mb-10">
              <h1 className="text-3xl font-bold text-gray-900">Book Your Appointment</h1>
              <p className="mt-2 text-gray-600">Select a service, date, and time for your spa appointment</p>
            </div>

            {error && (
              <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                <span className="block sm:inline">{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-6 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" role="alert">
                <span className="block sm:inline">Booking successful! Redirecting to your dashboard...</span>
              </div>
            )}

            <form onSubmit={handleBooking} className="space-y-6">
              <div>
                <label htmlFor="service" className="block text-sm font-medium text-gray-700 mb-1">
                  Select Service
                </label>
                <select
                  id="service"
                  name="service"
                  className="input-field"
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  required
                >
                  <option value="">Select a service</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} - ₹{service.price}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                    Select Date
                  </label>
                  <DatePicker
                    selected={selectedDate}
                    onChange={(date) => setSelectedDate(date)}
                    minDate={new Date()}
                    className="input-field"
                    dateFormat="MMMM d, yyyy"
                    required
                    inline
                    calendarClassName="bg-white shadow-lg border rounded-lg"
                    wrapperClassName="mb-4"
                    dayClassName={date =>
                      date.getDay() === 0 || date.getDay() === 6
                        ? "bg-blue-50 text-blue-600"
                        : undefined
                    }
                    popperClassName="z-50"
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    Weekends are highlighted in blue. Select a date to see available time slots.
                  </p>
                </div>

                <div>
                  <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-1">
                    Select Time
                  </label>
                  {availableTimes.length === 0 ? (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-yellow-700">No available time slots for this date. Please select another date.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <select
                        id="time"
                        name="time"
                        className="input-field"
                        value={selectedTime}
                        onChange={(e) => setSelectedTime(e.target.value)}
                        required
                      >
                        <option value="">Select a time</option>
                        {availableTimes.map((time) => (
                          <option key={time} value={time}>
                            {time} - {time.includes('12:') ?
                              time.replace('12:', '1:').replace('AM', 'PM') :
                              time.replace(/(\d+):/, (match, hour) => `${parseInt(hour) + 1}:`)}
                          </option>
                        ))}
                      </select>
                      <p className="text-sm text-gray-500">
                        All appointments are 1 hour long. Spa hours: 9 AM - 7 PM
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {(selectedService || selectedTime) && (
                <div className="bg-gray-50 p-4 rounded-md">
                  {selectedService && (
                    <>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Selected Service</h3>
                      <div className="text-gray-600 mb-4">
                        {services.find(s => s.id.toString() === selectedService.toString())?.description || 'Loading service details...'}
                      </div>
                    </>
                  )}

                  {selectedDate && selectedTime && (
                    <>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Appointment Details</h3>
                      <div className="flex flex-col space-y-2">
                        <div className="flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-gray-700">
                            {selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-gray-700">{selectedTime}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="flex justify-end space-x-4">
                <Link href="/" className="btn-secondary">
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={bookingLoading}
                  className="btn-primary"
                >
                  {bookingLoading ? 'Booking...' : 'Book Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}