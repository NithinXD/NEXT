import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // JSON read
    const filePath = path.join(process.cwd(), 'tools_docs.json');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const toolsData = JSON.parse(fileContent);
    
    console.log("API route called, returning tools documentation content from JSON file");
    
    return NextResponse.json({ 
      sections: toolsData.sections,
      success: true 
    });
  } catch (error) {
    console.error('Error in tools API route:', error);
    return NextResponse.json(
      { error: 'Failed to load tools documentation content', success: false },
      { status: 500 }
    );
  }
}