// Main Entry Point
// Initializes the desktop environment

document.addEventListener('DOMContentLoaded', () => {
    // 1. Load Icon Positions
    if (typeof loadIconPositions === 'function') {
        loadIconPositions();
    }

    // 2. Initialize Recycle Bin State (Restore missing icons)
    if (typeof initRecycleBinState === 'function') {
        // Ensure PVZ starts in recycle bin (remove any desktop remnants from previous state if needed)
        // This logic was in script.js, but initRecycleBinState handles most of it now.
        // We just need to make sure we don't have a stale icon if we want to force a state,
        // but initRecycleBinState is smart enough.
        
        // However, the original script had this specific block:
        /*
        const existingPvzIcon = document.getElementById('icon-pvz');
        if (existingPvzIcon) {
            existingPvzIcon.remove();
            localStorage.removeItem(PVZ_RESTORED_KEY);
        }
        */
        // This block in the original script seemed to be for debugging or a specific reset.
        // But later in the script it called initRecycleBinState().
        // Actually, looking at the original script, that block was:
        // "Initialize on load / Ensure PVZ starts in recycle bin..."
        // It seems the user might have wanted a hard reset at some point, but `initRecycleBinState`
        // is the robust way to handle persistence.
        // I will trust `initRecycleBinState` to do the right thing based on localStorage.
        
        initRecycleBinState();
    }

    // 3. Load Music
    if (typeof loadMusicManifest === 'function') {
        loadMusicManifest();
    }
    
    // 4. Render Recycle Bin (initRecycleBinState does this, but just in case)
    if (typeof renderRecycleBin === 'function') {
        renderRecycleBin();
    }
});
