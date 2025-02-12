async function updateTreeDescription(treeNumber, year, description) {
    const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbyrFuzALUp1BX83cYP0d7d3wgd8pUOG8TJ2nFWWW_f0qbOXbcF-nTQkdCoA1brdPWTDnA/exec';
    
    console.log('Attempting to update tree:', {
      sheetName: SHEET_NAME,
      treeNumber: treeNumber,
      year: year,
      description: description
    });
  
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      // Create data object
      const data = {
        sheetName: SHEET_NAME,
        treeNumber: treeNumber,
        year: year.toString(),
        description: description
      };
  
      xhr.open('POST', WEBAPP_URL);
      xhr.setRequestHeader('Content-Type', 'application/json');
  
      xhr.onload = function() {
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            console.log('Response:', response);
            if (response.status === 'success') {
              console.log('Update successful');
              resolve(true);
            } else {
              console.error('Update failed:', response.message);
              resolve(false);
            }
          } catch (error) {
            console.error('Error parsing response:', error);
            resolve(false);
          }
        } else {
          console.error('Request failed:', xhr.status);
          resolve(false);
        }
      };
  
      xhr.onerror = function() {
        console.error('Request failed');
        resolve(false);
      };
  
      // Send the request as JSON
      xhr.send(JSON.stringify(data));
    });
  }