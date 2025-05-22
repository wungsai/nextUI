'use client';

import React, { useState } from 'react';
// Image import removed as Next.js logo is no longer used here.
import FileUpload from "@/components/FileUpload";

export default function Home() {
  const [newFilename, setNewFilename] = useState<string>("");

  return (
    // The outer div with min-h-screen and bg-base-200 is removed.
    // Padding is kept for the content area.
    <div className="py-8 px-4 sm:px-8 font-[family-name:var(--font-geist-sans)]">
      {/* max-w-4xl was already present, container and mx-auto ensure it's centered. */}
      <main className="container mx-auto max-w-4xl"> 
        <div className="text-center mb-10 sm:mb-12">
          {/* Responsive text sizes for the main title */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-primary">PDF Management Hub</h1>
          <p className="mt-2 text-md sm:text-lg text-base-content/80">Upload, Preview, and Download Your PDFs with Ease</p>
        </div>
        
        {/* Card for renaming downloads */}
        <div className="card w-full bg-base-100 shadow-xl mb-6 sm:mb-8">
          {/* Adjusted padding for card body */}
          <div className="card-body p-6 sm:p-8"> 
            <h2 className="card-title text-lg sm:text-xl">Rename Downloads (Optional)</h2>
            <label htmlFor="newFilename" className="label pt-3 pb-1">
              {/* Responsive label text */}
              <span className="label-text text-sm sm:text-base">New base name for downloaded files (e.g., "MyDocument"). Extension will be added automatically.</span>
            </label>
            <input
              type="text"
              id="newFilename"
              value={newFilename}
              onChange={(e) => setNewFilename(e.target.value)}
              placeholder="Enter new filename base"
              // Ensure consistent text size with placeholder and input
              className="input input-bordered w-full text-sm sm:text-base" 
            />
          </div>
        </div>

        <FileUpload newFilenameBase={newFilename} />
        
        {/* The Next.js logo section and the local footer have been removed. */}
        {/* The global footer in layout.tsx now handles this. */}
      </main>
    </div>
  );
}
