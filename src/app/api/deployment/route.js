import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // JSON read
    const filePath = path.join(process.cwd(), 'deployment_docs.json');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const deploymentData = JSON.parse(fileContent);
    
    console.log("API route called, returning deployment documentation content from JSON file");
    
    return NextResponse.json({ 
      sections: deploymentData.sections,
      success: true 
    });
  } catch (error) {
    console.error('Error in deployment API route:', error);
    return NextResponse.json(
      { error: 'Failed to load deployment documentation content', success: false },
      { status: 500 }
    );
  }
}