'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import supabase from '../../lib/supabase';

export default function Services() {
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        // First, let's log the query we're making
        console.log('Fetching services from table: services');

        const { data, error } = await supabase
          .from('services')
          .select('*');

        // Log the raw response
        console.log('Raw services data:', data);
        console.log('Error if any:', error);

        if (error) {
          throw error;
        }

        // Map the data to match our application's expected format
        const formattedServices = data?.map(service => {
          console.log('Processing service:', service);
          return {
            id: service['Service ID'],
            name: service['Service Name'],
            description: service['Description'],
            price: service['Price (INR)'],
            category: service['Category']
          };
        }) || [];

        console.log('Formatted services:', formattedServices);
        setServices(formattedServices);

        // Extract unique categories
        if (formattedServices.length > 0) {
          const uniqueCategories = [...new Set(formattedServices.map(service => service.category))];
          const filteredCategories = uniqueCategories.filter(Boolean);
          console.log('Categories found:', filteredCategories);
          setCategories(filteredCategories);
        } else {
          console.log('No services found to extract categories');
        }
      } catch (error) {
        console.error('Error fetching services:', error);
        setError('Failed to load services. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, []);

  const filteredServices = selectedCategory === 'all'
    ? services
    : services.filter(service => service.category === selectedCategory);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="sr-only">Loading...</span>
          </div>
          <p className="mt-2">Loading services...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900">Our Services</h1>
          <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
            Discover our range of premium spa treatments designed to rejuvenate your body and mind.
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {/* Category Filter */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-md shadow-sm">
            <button
              type="button"
              className={`px-4 py-2 text-sm font-medium rounded-l-lg ${
                selectedCategory === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
              onClick={() => setSelectedCategory('all')}
            >
              All Services
            </button>
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={`px-4 py-2 text-sm font-medium ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                } ${
                  category === categories[categories.length - 1] ? 'rounded-r-lg' : ''
                }`}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredServices.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500">No services found in this category.</p>
            </div>
          ) : (
            filteredServices.map((service) => (
              <div key={service.id} className="bg-white rounded-lg shadow-md overflow-hidden transition-transform hover:scale-105">
                <div className="h-48 bg-gray-200"></div>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-bold text-gray-900">{service.name}</h3>
                    <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                      {service.duration} min
                    </span>
                  </div>
                  <p className="text-gray-600 mb-4">{service.description}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-2xl font-bold text-gray-900">₹{service.price}</span>
                    <Link
                      href={`/booking?service=${service.id}`}
                      className="btn-primary"
                    >
                      Book Now
                    </Link>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}