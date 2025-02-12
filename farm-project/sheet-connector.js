// Google Sheet Configuration
const SHEET_ID = '1z7GA4E8VWyRUqgLmzl50YZdEu2zRTZ1pjCbOVbcUnWI';
const API_KEY = 'AIzaSyBTJw2kHHhD4TLhKQ3uFCr9tW9lBWQaVmA';

// Get the current page name from the URL
const currentPage = window.location.pathname.split('/').pop().split('.')[0];
console.log('Full pathname:', window.location.pathname);
console.log('Current page name:', currentPage);

// Map page names to sheet names
const SHEET_NAMES = {
    'plum_alley': 'western%20trees',
    'lower_orchard_south': 'lower%20orchard%20south'
};

console.log('Mapped sheet name:', SHEET_NAMES[currentPage]);

// Get the correct sheet name for this page
const SHEET_NAME = SHEET_NAMES[currentPage] || 'western%20trees';  // Added fallback
console.log('Final SHEET_NAME:', SHEET_NAME);

let currentDescriptionIndex = 0;

async function getTreeData(treeName) {
    try {
        console.log('Looking for tree:', treeName);
        
        const [searchNumber, searchTreeName] = treeName.split(': ');
        console.log('Searching for tree number:', searchNumber);
        
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}?key=${API_KEY}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            console.error('Response status:', response.status);
            throw new Error('Failed to fetch data');
        }
        
        const data = await response.json();
        
        const treeRow = data.values?.find(row => {
            if (!row[0]) return false;
            return row[0].trim() === searchNumber.trim();
        });
        
        if (!treeRow) {
            console.log('No matching row found for tree number:', searchNumber);
            return null;
        }

        // Get date planted and general comments
        const datePlanted = treeRow[5] || ''; // Column F
        const generalComments = treeRow[6] || ''; // Column G
        
        // Get all descriptions with years
        const descriptions = [];
        for (let i = 12; i >= 7; i--) {
            if (treeRow[i] && treeRow[i].trim() !== '') {
                descriptions.push({
                    year: 2013 + (i-7),
                    text: treeRow[i].trim()
                });
            }
        }
        
        return {
            name: treeName,
            datePlanted: datePlanted ? `Planted ${datePlanted}` : '',
            generalComments: generalComments,
            descriptions: descriptions
        };
        
    } catch (error) {
        console.error('Error in getTreeData:', error);
        return null;
    }
}

function updateDescriptionDisplay(descriptions) {
    const prevButton = document.getElementById('prevDescription');
    const nextButton = document.getElementById('nextDescription');
    const descriptionElement = document.querySelector('#treeDetailText p');
    
    if (descriptions.length === 0) {
        descriptionElement.textContent = 'No updates available';
        prevButton.style.visibility = 'hidden';
        nextButton.style.visibility = 'hidden';
        return;
    }
    
    // Show current description with spacing after year
    const currentDesc = descriptions[currentDescriptionIndex];
    descriptionElement.textContent = `${currentDesc.year}    ${currentDesc.text}`;
    
    // Update button visibility
    prevButton.style.visibility = currentDescriptionIndex < descriptions.length - 1 ? 'visible' : 'hidden';
    nextButton.style.visibility = currentDescriptionIndex > 0 ? 'visible' : 'hidden';
    
    // Add navigation handlers
    prevButton.onclick = () => {
        if (currentDescriptionIndex < descriptions.length - 1) {
            currentDescriptionIndex++;
            updateDescriptionDisplay(descriptions);
        }
    };
    
    nextButton.onclick = () => {
        if (currentDescriptionIndex > 0) {
            currentDescriptionIndex--;
            updateDescriptionDisplay(descriptions);
        }
    };
}

async function updateTreePopup(treeName) {
    try {
        const treeData = await getTreeData(treeName);
        
        if (treeData) {
            const [treeNumber, treeName] = treeData.name.split(': ');
            currentDescriptionIndex = 0; // Reset to latest description
            
            document.querySelector('#treeDetailOverlay .title').textContent = treeName;
            document.querySelector('#treeNumber').textContent = treeNumber;
            document.querySelector('#datePlanted').textContent = treeData.datePlanted;
            document.querySelector('#generalComments').textContent = treeData.generalComments;
            
            updateDescriptionDisplay(treeData.descriptions);
        } else {
            document.querySelector('#treeDetailOverlay .title').textContent = treeName;
            document.querySelector('#treeNumber').textContent = '';
            document.querySelector('#datePlanted').textContent = '';
            document.querySelector('#generalComments').textContent = '';
            document.querySelector('#treeDetailText p').textContent = 'No data found for this tree';
        }
    } catch (error) {
        console.error('Error updating tree popup:', error);
        document.querySelector('#treeDetailText p').textContent = 'Error loading tree data';
    }
}

async function createTreeButtons() {
    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}?key=${API_KEY}`;
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
            
            const buttonContainer = document.createElement('div');
            buttonContainer.style.position = 'absolute';
            const topPosition = 100 - parseFloat(posY);
            buttonContainer.style.top = `${topPosition}%`;
            buttonContainer.style.left = `${posX}%`;

            // Create button with current circular style
            const button = document.createElement('button');
            button.id = `treeButton${index + 1}`;
            button.className = 'treeButton';
            button.setAttribute('data-tree-name', `${treeNumber}: ${treeName}`);
            button.style.cssText = `
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

            // Add tree icon
            const img = document.createElement('img');
            img.src = 'assets/tree icon green.svg';
            img.style.cssText = 'width: 24px; height: 24px; transform: translateX(-18%);';
            button.appendChild(img);

            // Add label for tree name
            const label = document.createElement('span');
            label.textContent = `${treeNumber} ${treeName}`;  // Show both number and name
            label.className = 'tree-label';
            label.style.cssText = `
                position: absolute;
                left: 40px;
                top: 30px;
                font-family: 'Karla', sans-serif;
                font-size: 16px;
                color:rgb(37, 255, 73);
                text-align: left;
                white-space: nowrap;
            `;

            buttonContainer.appendChild(button);
            buttonContainer.appendChild(label);
            container.appendChild(buttonContainer);
        });
        
        console.log('Tree buttons created successfully');
        
    } catch (error) {
        console.error('Error creating tree buttons:', error);
    }
}

async function updateTreeDescription(treeNumber, year, description) {
    const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbyrFuzALUp1BX83cYP0d7d3wgd8pUOG8TJ2nFWWW_f0qbOXbcF-nTQkdCoA1brdPWTDnA/exec';
    
    return new Promise((resolve, reject) => {
      try {
        console.log('Attempting to update tree:', {
          sheetName: SHEET_NAME,
          treeNumber: treeNumber,
          year: year,
          description: description
        });
        
        // Create a unique callback name
        const callbackName = 'callback_' + Math.random().toString(36).substr(2, 9);
        
        // Create the script element
        const script = document.createElement('script');
        const payload = {
          sheetName: SHEET_NAME,
          treeNumber: treeNumber,
          year: year,
          description: description
        };
        
        // Add the callback function to window
        window[callbackName] = function(response) {
          // Clean up
          document.body.removeChild(script);
          delete window[callbackName];
          
          console.log('Response received:', response);
          
          if (response.status === 'success') {
            console.log('Update successful');
            resolve(true);
          } else {
            console.error('Update failed:', response.message);
            resolve(false);
          }
        };
        
        // Create the URL with parameters
        const url = `${WEBAPP_URL}?callback=${callbackName}&payload=${encodeURIComponent(JSON.stringify(payload))}`;
        script.src = url;
        
        // Handle errors
        script.onerror = () => {
          document.body.removeChild(script);
          delete window[callbackName];
          console.error('Script load error');
          resolve(false);
        };
        
        // Add the script to the page
        document.body.appendChild(script);
        
      } catch (error) {
        console.error('Error updating tree description:', error);
        resolve(false);
      }
    });
  }