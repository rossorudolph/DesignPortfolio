// Google Sheet Configuration
const SHEET_ID = '1z7GA4E8VWyRUqgLmzl50YZdEu2zRTZ1pjCbOVbcUnWI';
const API_KEY = 'AIzaSyBTJw2kHHhD4TLhKQ3uFCr9tW9lBWQaVmA';

let currentDescriptionIndex = 0;

async function getTreeData(treeName) {
    try {
        console.log('Looking for tree:', treeName);
        
        const [searchNumber, searchTreeName] = treeName.split(': ');
        console.log('Searching for tree number:', searchNumber);
        
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/western%20trees?key=${API_KEY}`;
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
            
            const buttonContainer = document.createElement('div');
            buttonContainer.style.position = 'absolute';
            buttonContainer.style.top = `${posY}%`;
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
            label.textContent = treeName;
            label.className = 'tree-label';  // Add this class for toggling visibility
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