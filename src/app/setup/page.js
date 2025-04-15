'use client';

import { useState } from 'react';
import supabase from '../../lib/supabase';

export default function SetupPage() {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const sampleServices = [
    {
      "Service Name": "Swedish Massage",
      "Description": "A gentle full body massage that is excellent for relaxation and stress relief.",
      "Price (INR)": 1500,
      "Category": "Massage"
    },
    {
      "Service Name": "Deep Tissue Massage",
      "Description": "Focuses on realigning deeper layers of muscles and connective tissue.",
      "Price (INR)": 2000,
      "Category": "Massage"
    },
    {
      "Service Name": "Classic Facial",
      "Description": "Deep cleansing facial treatment that includes exfoliation and extraction.",
      "Price (INR)": 1200,
      "Category": "Facial"
    },
    {
      "Service Name": "Manicure",
      "Description": "Nail and cuticle care, hand massage, and polish application.",
      "Price (INR)": 800,
      "Category": "Nail Care"
    },
    {
      "Service Name": "Pedicure",
      "Description": "Foot soak, exfoliation, nail care, and polish application.",
      "Price (INR)": 1000,
      "Category": "Nail Care"
    }
  ];

  const handleInsertSampleData = async () => {
    setLoading(true);
    setMessage('Inserting sample data...');
    setError(null);
    setSuccess(false);

    try {
      //check table exists
      const { count, error: countError } = await supabase
        .from('services')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        throw new Error(`Error checking services table: ${countError.message}`);
      }

      if (count > 0) {
        setMessage(`Services table already has ${count} records. No need to insert sample data.`);
        setSuccess(true);
        return;
      }

      // Insert sample data
      const { data, error } = await supabase
        .from('services')
        .insert(sampleServices);

      if (error) {
        throw new Error(`Error inserting sample data: ${error.message}`);
      }

      setMessage(`Successfully inserted ${sampleServices.length} sample services!`);
      setSuccess(true);
    } catch (err) {
      console.error('Setup error:', err);
      setError(err.message);
      setMessage('Failed to insert sample data.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Setup Database</h1>
            
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Insert Sample Services</h2>
              <p className="mb-4">
                This will insert sample spa services into your database. This is useful if your services table is empty.
              </p>
              
              <button
                onClick={handleInsertSampleData}
                disabled={loading}
                className={`px-4 py-2 rounded font-medium ${
                  loading 
                    ? 'bg-gray-300 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {loading ? 'Processing...' : 'Insert Sample Data'}
              </button>
              
              {message && (
                <div className={`mt-4 p-4 rounded ${
                  error 
                    ? 'bg-red-100 text-red-700 border border-red-400' 
                    : success 
                      ? 'bg-green-100 text-green-700 border border-green-400'
                      : 'bg-blue-100 text-blue-700 border border-blue-400'
                }`}>
                  <p>{message}</p>
                  {error && <p className="mt-2 font-semibold">{error}</p>}
                </div>
              )}
            </div>
            
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4">Sample Services to be Added</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price (INR)</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sampleServices.map((service, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{service["Service Name"]}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{service["Description"]}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{service["Price (INR)"]}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{service["Category"]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}