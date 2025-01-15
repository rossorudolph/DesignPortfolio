// Google Sheet Configuration
const SHEET_ID = '1z7GA4E8VWyRUqgLmzl50YZdEu2zRTZ1pjCbOVbcUnWI';
const API_KEY = 'AIzaSyBTJw2kHHhD4TLhKQ3uFCr9tW9lBWQaVmA';

// Debug Logging
let DEBUG = true;

async function getTreeData(treeName) {
    try {
        console.log('Looking for tree:', treeName);
        
        // Split the search name into number and name parts
        const [searchNumber, searchTreeName] = treeName.split(': ');
        console.log('Searching for tree number:', searchNumber);
        
        // Get sheet data
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/western%20trees?key=${API_KEY}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            console.error('Response status:', response.status);
            throw new Error('Failed to fetch data');
        }
        
        const data = await response.json();
        
        // Find the tree row by matching the tree number
        const treeRow = data.values?.find(row => {
            if (!row[0]) return false;
            return row[0].trim() === searchNumber.trim();
        });
        
        if (!treeRow) {
            console.log('No matching row found for tree number:', searchNumber);
            return null;
        }
        
        // Get latest description - adjusted indices for new column structure
        let latestDescription = '';
        // Now starting from column L (index 11) back to column F (index 5)
        for (let i = 11; i >= 5; i--) {
            if (treeRow[i] && treeRow[i].trim() !== '') {
                latestDescription = `${treeRow[i]} (${2013 + (i-5)})`;  // Adjusted year calculation
                break;
            }
        }
        
        return {
            name: treeName,
            description: latestDescription || 'No updates available'
        };
        
    } catch (error) {
        console.error('Error in getTreeData:', error);
        return null;
    }
}

async function createTreeButtons() {
    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/western%20trees?key=${API_KEY}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('Failed to fetch data');
        }
        
        const data = await response.json();
        const dataRows = data.values.slice(1); // Skip header row
        
        const container = document.querySelector('div[style*="position: relative"]');
        
        dataRows.forEach((row, index) => {
            const treeNumber = row[0];    // Column A - Tree number
            const treeName = row[1];      // Column B - Tree name
            const posX = row[2] || '30';  // Column C - X position
            const posY = row[3] || '30';  // Column D - Y position
            const isDead = row[4];        // Column E - Dead status
            
            if (!treeNumber || !treeName || isDead?.toLowerCase() === 'x') return;
            
            const button = document.createElement('button');
            button.id = `treeButton${index + 1}`;
            button.className = 'treeButton';
            button.setAttribute('data-tree-name', `${treeNumber}: ${treeName}`);
            
            button.style.cssText = `
                position: absolute;
                top: ${posY}%;
                left: ${posX}%;
                background-color: rgba(255, 255, 255, 0.5);
                color: #1C4E24;
                border: 2px solid #1C4E24;
                padding: 10px 20px;
                font-size: 20px;
                cursor: pointer;
                border-radius: 50%;
                width: 60px;
                height: 60px;
            `;
            
            const img = document.createElement('img');
            img.src = 'assets/tree icon green.svg';
            img.style.cssText = 'width: 24px; height: 24px; transform: translateX(-18%);';
            button.appendChild(img);
            
            container.appendChild(button);
        });
        
        console.log('Tree buttons created successfully');
        
    } catch (error) {
        console.error('Error creating tree buttons:', error);
    }
}

// Function to update the tree popup
async function updateTreePopup(treeName) {
    try {
        const treeData = await getTreeData(treeName);
        
        if (treeData) {
            // Split the name into tree number and name
            const [treeNumber, treeName] = treeData.name.split(': ');
            
            // Update the title with just the tree name
            document.querySelector('#treeDetailOverlay .title').textContent = treeName;
            
            // Update the tree number
            document.querySelector('#treeNumber').textContent = treeNumber;
            
            // Update the description
            document.querySelector('#treeDetailText p').textContent = treeData.description;
        } else {
            document.querySelector('#treeDetailOverlay .title').textContent = treeName;
            document.querySelector('#treeNumber').textContent = '';
            document.querySelector('#treeDetailText p').textContent = 'No data found for this tree';
        }
    } catch (error) {
        console.error('Error updating tree popup:', error);
        document.querySelector('#treeDetailText p').textContent = 'Error loading tree data';
    }
}