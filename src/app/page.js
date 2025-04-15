'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import supabase from '../lib/supabase';

export default function Home() {
  const [user, setUser] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };

    // Fetch services
    const fetchServices = async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*');

      if (error) {
        console.error('Error fetching services:', error);
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
      }
      setLoading(false);
    };

    checkUser();
    fetchServices();
  }, []);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative h-[80vh] bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-600 animated-gradient">
        <div className="absolute inset-0 bg-black opacity-30"></div>
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-white text-center px-4">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">Luxury Spa Experience</h1>
          <p className="text-xl md:text-2xl mb-8 max-w-2xl">Relax, rejuvenate, and refresh with our premium spa services</p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/booking" className="btn-primary text-lg px-8 py-3">
              Book Now
            </Link>
            <Link href="/services" className="bg-white text-blue-600 hover:bg-gray-100 font-bold py-3 px-8 rounded text-lg">
              View Services
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Services */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Our Premium Services</h2>
          
          {loading ? (
            <div className="text-center">Loading services...</div>
          ) : services.length === 0 ? (
            <div className="text-center">No services available at the moment.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {services.slice(0, 3).map((service) => (
                <div key={service.id} className="card hover:shadow-lg transition-shadow">
                  <div className="h-48 bg-gray-200 mb-4 rounded-md"></div>
                  <h3 className="text-xl font-semibold mb-2">{service.name}</h3>
                  <p className="text-gray-600 mb-4">{service.description}</p>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-lg">₹{service.price}</span>
                    <Link href={`/booking?service=${service.id}`} className="btn-primary">
                      Book Now
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="text-center mt-12">
            <Link href="/services" className="btn-secondary">
              View All Services
            </Link>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12">
          <div className="md:w-1/2">
            <div className="h-96 bg-gray-200 rounded-lg"></div>
          </div>
          <div className="md:w-1/2">
            <h2 className="text-3xl font-bold mb-6">About Our Spa</h2>
            <p className="text-gray-600 mb-6">
              Our luxury spa offers a tranquil escape from the hustle and bustle of everyday life. 
              With state-of-the-art facilities and expert therapists, we provide a range of treatments 
              designed to rejuvenate your body and mind.
            </p>
            <p className="text-gray-600 mb-8">
              From massages and facials to body treatments and wellness packages, 
              we have everything you need for a perfect day of relaxation and self-care.
            </p>
            <Link href="/about" className="btn-secondary">
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* Location Section */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Our Location</h2>
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="md:w-1/2">
              <div className="h-80 bg-gray-200 rounded-lg"></div>
            </div>
            <div className="md:w-1/2">
              <h3 className="text-2xl font-semibold mb-4">Visit Us</h3>
              <p className="text-gray-600 mb-2">1965 Relaxation Avenue</p>
              <p className="text-gray-600 mb-2">Madurai, Tamil Nadu, 625017</p>
              <p className="text-gray-600 mb-6">Phone: +91 8838745128</p>
              <h4 className="text-xl font-semibold mb-2">Hours</h4>
              <p className="text-gray-600 mb-1">Monday - Sunday: 9am - 7pm</p>
              <Link href="/contact" className="btn-primary">
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-primary-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to Experience Luxury?</h2>
          <p className="text-xl mb-8">Book your appointment today and treat yourself to the relaxation you deserve.</p>
          <Link href="/booking" className="bg-white text-primary-600 hover:bg-gray-100 font-bold py-3 px-8 rounded text-lg">
            Book Your Appointment
          </Link>
        </div>
      </section>
    </div>
  );
}