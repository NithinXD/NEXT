import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // JSON read
    const filePath = path.join(process.cwd(), 'memory_docs.json');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const docsData = JSON.parse(fileContent);
    
    console.log("API route called, returning documentation content from JSON file");
    
    return NextResponse.json({ 
      sections: docsData.sections,
      success: true 
    });
  } catch (error) {
    console.error('Error in docs API route:', error);
    return NextResponse.json(
      { error: 'Failed to load documentation content', success: false },
      { status: 500 }
    );
  }
}