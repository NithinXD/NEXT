'use client';

import { useState, useEffect } from 'react';
import supabase from '../../lib/supabase';

export default function DebugPage() {
  const [tables, setTables] = useState([]);
  const [servicesData, setServicesData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Try to get a list of all tables
        const { data: tablesData, error: tablesError } = await supabase
          .rpc('get_tables');

        if (tablesError) {
          console.error('Error fetching tables:', tablesError);
          setTables(['Error fetching tables']);
        } else {
          setTables(tablesData || []);
        }

        // Try different case variations and schema prefixes
        const variations = [
          'services',
          'Services',
          'SERVICES',
          'public.services',
          'PUBLIC.services',
          'public.Services'
        ];

        let foundData = null;
        let foundVariation = null;

        for (const variation of variations) {
          console.log(`Trying to query table: ${variation}`);
          const { data, error } = await supabase
            .from(variation)
            .select('*')
            .limit(10);

          console.log(`Result for ${variation}:`, { data, error });

          if (!error && data && data.length > 0) {
            foundData = data;
            foundVariation = variation;
            break;
          }
        }

        if (foundData) {
          console.log(`Successfully found data in table: ${foundVariation}`);
          setServicesData({
            tableName: foundVariation,
            data: foundData
          });
        } else {
          // Try one more approach - check if the table exists but is empty
          const { count, error: countError } = await supabase
            .from('services')
            .select('*', { count: 'exact', head: true });

          console.log('Count query result:', { count, error: countError });

          if (countError) {
            setError('Could not find services table. Error: ' + countError.message);
          } else if (count === 0) {
            setError('Services table exists but is empty');
          } else {
            // Try a direct SQL query as a last resort
            try {
              const { data: directData, error: directError } = await supabase.auth.getSession();
              console.log('Current session:', directData);

              setError('Services table exists and has data, but we cannot access it. Possible permission issue. Check console for details.');
            } catch (sessionErr) {
              console.error('Session error:', sessionErr);
              setError('Services table exists but cannot be accessed. Authentication issue.');
            }
          }
        }
      } catch (err) {
        console.error('Debug error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Database Debug Page</h1>
            
            {loading ? (
              <p>Loading database information...</p>
            ) : error ? (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                <p>{error}</p>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">Available Tables</h2>
                  {tables.length > 0 ? (
                    <ul className="list-disc pl-5">
                      {tables.map((table, index) => (
                        <li key={index} className="mb-1">{table}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>No tables found or unable to retrieve table list</p>
                  )}
                </div>

                <div>
                  <h2 className="text-xl font-semibold mb-4">Services Data</h2>
                  {servicesData ? (
                    <div>
                      <p className="mb-2">Found data in table: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{servicesData.tableName}</span></p>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              {Object.keys(servicesData.data[0]).map((key) => (
                                <th key={key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  {key}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {servicesData.data.map((row, rowIndex) => (
                              <tr key={rowIndex}>
                                {Object.values(row).map((value, valueIndex) => (
                                  <td key={valueIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {value !== null ? String(value) : 'null'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <p>No services data found</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}