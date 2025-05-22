import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TablePagination
} from '@mui/material';
import { db } from './firebase';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import Checkbox from '@mui/material/Checkbox';

function PriceListManager() {
  const [priceLists, setPriceLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [csvFileName, setCsvFileName] = useState("");
  const [priceListName, setPriceListName] = useState("");
  const [uploadError, setUploadError] = useState(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [priceListToDelete, setPriceListToDelete] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editingPriceList, setEditingPriceList] = useState(null);
  const [editedData, setEditedData] = useState(null);
  const [savingEdits, setSavingEdits] = useState(false);
  const [hasEdits, setHasEdits] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRows, setSelectedRows] = useState([]);
  const [bulkEditField, setBulkEditField] = useState("");
  const [bulkEditValue, setBulkEditValue] = useState("");
  const [bulkEditType, setBulkEditType] = useState("replace");
  const [filteredData, setFilteredData] = useState([]);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [scrollOffset, setScrollOffset] = useState(0);
  const listRef = useRef(null);

  // Debounce-funktion för sökning
  const debounceSearch = useCallback((value) => {
    setSearchTerm(value);
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(value);
    }, 300);
    
    return () => clearTimeout(timer);
  }, []);

  // Hämta sparade prislistor
  const fetchPriceLists = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, "priceLists"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      
      const fetchedPriceLists = [];
      querySnapshot.forEach((doc) => {
        fetchedPriceLists.push({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date()
        });
      });
      
      setPriceLists(fetchedPriceLists);
      setLoading(false);
    } catch (error) {
      console.error("Fel vid hämtning av prislistor:", error);
      setLoading(false);
    }
  };

  // Hämta prislistor när komponenten laddas
  useEffect(() => {
    fetchPriceLists();
  }, []);

  // Lägg till denna useEffect för att filtrera data när söktermen ändras
  useEffect(() => {
    if (!editedData) return;
    
    if (!searchTerm) {
      setFilteredData(editedData);
      return;
    }
    
    const searchTermLower = searchTerm.toLowerCase();
    const filtered = editedData.filter(row => {
      const rowText = Object.values(row).join(' ').toLowerCase();
      return rowText.includes(searchTermLower);
    });
    
    setFilteredData(filtered);
  }, [searchTerm, editedData]);

  // Formatera datum
  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleString('sv-SE', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Öppna dialog för att ladda upp en ny prislista
  const openUploadDialog = () => {
    setUploadDialogOpen(true);
    setCsvFile(null);
    setCsvFileName("");
    setPriceListName("");
    setUploadError(null);
    setPreviewData(null);
  };

  // Hantera val av CSV-fil
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setCsvFile(null);
      setCsvFileName("");
      setPreviewData(null);
      return;
    }
    
    if (!file.name.endsWith('.csv')) {
      setUploadError("Välj en fil med .csv-format");
      setCsvFile(null);
      setCsvFileName("");
      setPreviewData(null);
      return;
    }
    
    setCsvFile(file);
    setCsvFileName(file.name);
    setUploadError(null);
    
    // Läs filen för att förhandsgranska och validera
    const reader = new FileReader();
    reader.onload = (event) => {
      const csvData = event.target.result;
      const validationResult = parseCSV(csvData);
      
      if (validationResult.valid) {
        setPreviewData(validationResult);
        setUploadError(null);
      } else {
        setUploadError(validationResult.error);
        setPreviewData(null);
      }
    };
    
    reader.onerror = () => {
      setUploadError("Fel vid läsning av filen");
      setPreviewData(null);
    };
    
    reader.readAsText(file);
  };

  // Parsning av CSV-data
  const parseCSV = (csvData) => {
    try {
      // Dela upp rader
      const rows = csvData.split(/\r?\n/).filter(row => row.trim().length > 0);
      if (rows.length < 2) {
        return { valid: false, error: "CSV-filen måste innehålla rubriker och minst en rad med data." };
      }
      
      // Extrahera rubriker
      const headers = parseCSVRow(rows[0]);
      
      // Kontrollera nödvändiga kolumner
      const requiredColumns = ["ProductID", "Size", "Price", "Currency"];
      const missingColumns = requiredColumns.filter(col => !headers.includes(col));
      
      if (missingColumns.length > 0) {
        return { 
          valid: false, 
          error: `Saknade kolumner i prislistan: ${missingColumns.join(", ")}` 
        };
      }
      
      // Parsa datarader
      const items = [];
      for (let i = 1; i < rows.length; i++) {
        if (!rows[i].trim()) continue;
        
        const values = parseCSVRow(rows[i]);
        if (values.length !== headers.length) {
          return { 
            valid: false, 
            error: `Rad ${i+1} har felaktigt antal kolumner.` 
          };
        }
        
        // Skapa objekt från rubriker och värden
        const item = {};
        headers.forEach((header, index) => {
          item[header] = values[index];
        });
        
        // Validera priser och skapa unikt ID
        const productId = item["ProductID"];
        const size = item["Size"];
        const price = parseFloat(item["Price"]);
        const currency = item["Currency"];
        
        if (!productId || isNaN(price) || !currency) {
          return { 
            valid: false, 
            error: `Rad ${i+1} har ogiltiga data.`
          };
        }
        
        items.push({
          productId,
          size,
          price,
          currency
        });
      }
      
      // Skapa en mappning av produkt-ID + storlek till pris
      const priceMap = {};
      items.forEach(item => {
        const key = `${item.productId}_${item.size}`;
        priceMap[key] = {
          price: item.price,
          currency: item.currency
        };
      });
      
      return { 
        valid: true, 
        headers, 
        items,
        priceMap,
        rawData: csvData
      };
    } catch (error) {
      return { valid: false, error: `Fel vid parsning av CSV: ${error.message}` };
    }
  };

  // Hjälpfunktion för att parsa CSV-rad
  const parseCSVRow = (row) => {
    const result = [];
    let insideQuotes = false;
    let currentValue = "";
    
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        result.push(currentValue.trim());
        currentValue = "";
      } else {
        currentValue += char;
      }
    }
    
    // Lägg till det sista värdet
    result.push(currentValue.trim());
    
    return result;
  };

  // Ladda upp prislistan till Firestore
  const uploadPriceList = async () => {
    if (!csvFile || !previewData || !previewData.valid) {
      setUploadError("Vänligen välj en giltig CSV-fil");
      return;
    }
    
    if (!priceListName.trim()) {
      setUploadError("Vänligen ange ett namn för prislistan");
      return;
    }
    
    try {
      setUploading(true);
      
      // Skapa nytt dokument i Firestore
      await addDoc(collection(db, "priceLists"), {
        name: priceListName,
        fileName: csvFileName,
        createdAt: serverTimestamp(),
        itemCount: previewData.items.length,
        rawData: previewData.rawData,
        priceMap: previewData.priceMap
      });
      
      // Uppdatera listan
      fetchPriceLists();
      
      // Stäng dialogen
      setUploadDialogOpen(false);
      setUploading(false);
      
      // Rensa formuläret
      setCsvFile(null);
      setCsvFileName("");
      setPriceListName("");
      setPreviewData(null);
    } catch (error) {
      console.error("Fel vid uppladdning av prislista:", error);
      setUploadError(`Fel vid uppladdning: ${error.message}`);
      setUploading(false);
    }
  };

  // Bekräfta borttagning av prislista
  const confirmDelete = (priceList) => {
    setPriceListToDelete(priceList);
    setDeleteDialogOpen(true);
  };

  // Ta bort prislista
  const deletePriceList = async () => {
    if (!priceListToDelete) return;
    
    try {
      await deleteDoc(doc(db, "priceLists", priceListToDelete.id));
      setPriceLists(prev => prev.filter(p => p.id !== priceListToDelete.id));
      setDeleteDialogOpen(false);
      setPriceListToDelete(null);
    } catch (error) {
      console.error("Fel vid borttagning av prislista:", error);
      alert(`Fel vid borttagning: ${error.message}`);
    }
  };

  // Ladda ner CSV-filen
  const downloadCSV = (priceList) => {
    if (!priceList.rawData) return;
    
    const blob = new Blob([priceList.rawData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.setAttribute('href', url);
    link.setAttribute('download', priceList.fileName || `${priceList.name.replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Funktion för att starta redigering av en prislista
  const startEditingPriceList = (priceList) => {
    console.log("Startar redigering av prislista:", priceList.name);
    setEditingPriceList(priceList);
    
    // Parsera CSV-data till ett redigerbart format om den finns
    if (priceList.rawData) {
      try {
        const rows = priceList.rawData.split('\n');
        const headers = parseCSVRow(rows[0]);
        
        // Skapa en array av objekt från CSV-data
        const parsedData = [];
        for (let i = 1; i < rows.length; i++) {
          if (!rows[i].trim()) continue; // Hoppa över tomma rader
          
          const values = parseCSVRow(rows[i]);
          const rowData = {};
          
          headers.forEach((header, index) => {
            rowData[header.trim()] = values[index] || '';
          });
          
          parsedData.push(rowData);
        }
        
        setEditedData(parsedData);
        setEditMode(true);
        setHasEdits(false); // Återställ redigeringsstatus
      } catch (error) {
        console.error("Fel vid parsning av CSV-data:", error);
        alert("Kunde inte öppna prislistan för redigering. Kontrollera formatet.");
      }
    } else {
      alert("Denna prislista saknar data som kan redigeras.");
    }
  };

  // Funktion för att avbryta redigering
  const handleCloseEditMode = () => {
    if (hasEdits) {
      setCancelConfirmOpen(true);
    } else {
      setEditMode(false);
      setEditingPriceList(null);
      setEditedData(null);
    }
  };

  // Uppdatera handleDataChange för att bevara scrollpositionen
  const handleDataChange = (rowIndex, field, value) => {
    // Spara nuvarande scrollposition om vi har ett listRef
    if (listRef.current) {
      setScrollOffset(listRef.current.state.scrollOffset);
    }
    
    setEditedData(prevData => {
      // Skapa en kopia av den enda raden som behöver uppdateras
      const updatedRow = { ...prevData[rowIndex], [field]: value };
      
      // Skapa en ny array men återanvänd alla oförändrade rader
      return [
        ...prevData.slice(0, rowIndex),
        updatedRow,
        ...prevData.slice(rowIndex + 1)
      ];
    });
    
    setHasEdits(true);
  };

  // Scroll till den sparade positionen efter uppdatering
  useEffect(() => {
    if (listRef.current && scrollOffset > 0) {
      listRef.current.scrollTo(scrollOffset);
    }
  }, [filteredData, scrollOffset]);

  // Funktion för att spara redigerade prislistor
  const saveEditedPriceList = async () => {
    if (!editingPriceList || !editedData) {
      alert("Ingen data att spara.");
      return;
    }
    
    // Validera data innan sparande
    const validationErrors = validateEditedData();
    if (validationErrors.length > 0) {
      alert(`Kunde inte spara prislistor på grund av följande fel:\n\n${validationErrors.join('\n')}`);
      return;
    }
    
    try {
      setSavingEdits(true);
      
      // Konvertera redigerad data tillbaka till CSV
      const headers = Object.keys(editedData[0]);
      const csvRows = [headers.join(',')];
      
      editedData.forEach(row => {
        const values = headers.map(header => {
          const value = row[header] || '';
          // Omslut värden med kommatecken i citattecken
          return value.toString().includes(',') ? `"${value}"` : value;
        });
        csvRows.push(values.join(','));
      });
      
      const updatedCsvData = csvRows.join('\n');
      
      // Uppdatera dokumentet i Firestore
      const priceListRef = doc(db, "priceLists", editingPriceList.id);
      await updateDoc(priceListRef, {
        rawData: updatedCsvData,
        updatedAt: serverTimestamp(),
        lastEditedBy: "Admin" // Du kan ersätta detta med användarinformation om det finns
      });
      
      // Uppdatera UI och avsluta redigeringsläge
      alert("Prislistan har uppdaterats!");
      setEditMode(false);
      setEditingPriceList(null);
      setEditedData(null);
      setHasEdits(false);
      fetchPriceLists(); // Hämta uppdaterade prislistor
    } catch (error) {
      console.error("Fel vid sparande av redigerad prislista:", error);
      alert(`Fel vid sparande: ${error.message}`);
    } finally {
      setSavingEdits(false);
    }
  };

  // Validera alla rader innan sparande
  const validateEditedData = () => {
    const errors = [];
    
    editedData.forEach((row, index) => {
      // Kontrollera att produktID finns
      if (!row.ProductID || row.ProductID.trim() === '') {
        errors.push(`Rad ${index + 1}: ProductID saknas`);
      }
      
      // Kontrollera att pris är ett giltigt nummer
      if (isNaN(parseFloat(row.Price))) {
        errors.push(`Rad ${index + 1}: Ogiltigt pris "${row.Price}"`);
      }
      
      // Kontrollera att valuta är giltig
      const validCurrencies = ["SEK", "EUR", "USD", "GBP"];
      if (!validCurrencies.includes(row.Currency)) {
        errors.push(`Rad ${index + 1}: Ogiltig valuta "${row.Currency}"`);
      }
    });
    
    return errors;
  };
  
  // Funktion för att hantera bulkredigering
  const handleBulkEdit = () => {
    const newData = [...editedData];
    
    // Bearbeta data i batches för stora datamängder
    const batchSize = 100;
    let processed = 0;
    
    function processBatch() {
      const endIndex = Math.min(processed + batchSize, selectedRows.length);
      const batch = selectedRows.slice(processed, endIndex);
      
      batch.forEach(rowIndex => {
        if (bulkEditField === 'Price' && bulkEditType === 'percentage') {
          // Procentuell ändring av pris
          const currentPrice = parseFloat(newData[rowIndex][bulkEditField]) || 0;
          const percentage = parseFloat(bulkEditValue) || 0;
          const newPrice = currentPrice * (1 + percentage / 100);
          newData[rowIndex][bulkEditField] = newPrice.toFixed(2);
        } else {
          // Vanlig ersättning
          newData[rowIndex][bulkEditField] = bulkEditValue;
        }
      });
      
      processed = endIndex;
      
      if (processed < selectedRows.length) {
        // Fortsätt med nästa batch i nästa animation frame
        requestAnimationFrame(processBatch);
      } else {
        // Vi är klara med alla batcher
        setEditedData(newData);
        setBulkEditValue("");
        setSelectedRows([]);
        setHasEdits(true);
      }
    }
    
    // Starta batch-processen
    processBatch();
  };
  
  // Uppdatera MemoizedTextField för att förhindra att Enter-tangenten orsakar oönskad effekt
  const MemoizedTextField = React.memo(({value, onChange, ...props}) => (
    <TextField
      {...props}
      value={value}
      onChange={onChange}
      onKeyDown={(e) => {
        // Förhindra standardbeteende för Enter-tangenten
        if (e.key === 'Enter') {
          e.preventDefault();
          // Hitta nästa element att fokusera eller gör ingenting
        }
      }}
    />
  ));

  const MemoizedSelect = React.memo(({value, onChange, children, ...props}) => (
    <Select
      {...props}
      value={value}
      onChange={onChange}
    >
      {children}
    </Select>
  ));

  // Uppdatera renderEditControl
  const renderEditControl = (row, rowIndex, field) => {
    // Formatera priser med två decimaler
    if (field === 'Price') {
      return (
        <MemoizedTextField
          fullWidth
          size="small"
          variant="outlined"
          type="number"
          step="0.01"
          value={row[field]}
          onChange={(e) => handleDataChange(rowIndex, field, e.target.value)}
          inputProps={{ 
            min: 0,
            step: 0.01,
            style: { textAlign: 'right' } 
          }}
        />
      );
    }
    
    // Dropdown för valuta
    if (field === 'Currency') {
      return (
        <MemoizedSelect
          fullWidth
          size="small"
          value={row[field]}
          onChange={(e) => handleDataChange(rowIndex, field, e.target.value)}
        >
          <MenuItem value="SEK">SEK</MenuItem>
          <MenuItem value="EUR">EUR</MenuItem>
          <MenuItem value="USD">USD</MenuItem>
          <MenuItem value="GBP">GBP</MenuItem>
        </MemoizedSelect>
      );
    }
    
    // Standard textfält för övriga kolumner
    return (
      <MemoizedTextField
        fullWidth
        size="small"
        variant="outlined"
        value={row[field]}
        onChange={(e) => handleDataChange(rowIndex, field, e.target.value)}
      />
    );
  };

  // Använd useMemo för effektiv filtrering och paginering
  const paginatedData = useMemo(() => {
    if (!filteredData) return [];
    const startIndex = page * rowsPerPage;
    return filteredData.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredData, page, rowsPerPage]);

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h1">
          Hantera prislistor
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<CloudUploadIcon />}
          onClick={openUploadDialog}
        >
          Ladda upp prislista
        </Button>
      </Box>
      
      {loading ? (
        <Box display="flex" alignItems="center" justifyContent="center" height="60vh">
          <CircularProgress />
        </Box>
      ) : priceLists.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1">
            Inga prislistor har laddats upp ännu. Klicka på "Ladda upp prislista" för att komma igång.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Namn</TableCell>
                <TableCell>Filnamn</TableCell>
                <TableCell>Uppladdad</TableCell>
                <TableCell align="right">Antal produkter</TableCell>
                <TableCell align="right">Åtgärder</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {priceLists.map((priceList) => (
                <TableRow key={priceList.id} hover>
                  <TableCell>{priceList.name}</TableCell>
                  <TableCell>{priceList.fileName}</TableCell>
                  <TableCell>{formatDate(priceList.createdAt)}</TableCell>
                  <TableCell align="right">{priceList.itemCount}</TableCell>
                  <TableCell align="right">
                    <Box display="flex" justifyContent="flex-end" gap={1}>
                      <Tooltip title="Ladda ner prislista">
                        <IconButton 
                          color="primary" 
                          size="small"
                          onClick={() => downloadCSV(priceList)}
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      
                      <Tooltip title="Redigera prislista">
                        <IconButton 
                          color="secondary" 
                          size="small"
                          onClick={() => startEditingPriceList(priceList)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      
                      <Tooltip title="Ta bort prislista">
                        <IconButton 
                          color="error" 
                          size="small"
                          onClick={() => confirmDelete(priceList)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      
      {/* Dialog för att ladda upp prislista */}
      <Dialog 
        open={uploadDialogOpen} 
        onClose={() => setUploadDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Ladda upp prislista</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Ladda upp en CSV-fil med prisinformation för produkter. Filen måste innehålla kolumnerna: 
            ProductID, Size, Price, Currency.
          </DialogContentText>
          
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Prislistans namn"
                fullWidth
                value={priceListName}
                onChange={(e) => setPriceListName(e.target.value)}
                required
                disabled={uploading}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Button
                variant="outlined"
                component="label"
                fullWidth
                sx={{ height: '56px' }}
                disabled={uploading}
              >
                Välj CSV-fil
                <input
                  type="file"
                  accept=".csv"
                  hidden
                  onChange={handleFileChange}
                />
              </Button>
            </Grid>
          </Grid>
          
          {csvFileName && (
            <Typography variant="body2" sx={{ mb: 2 }}>
              Vald fil: <strong>{csvFileName}</strong>
            </Typography>
          )}
          
          {uploadError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {uploadError}
            </Alert>
          )}
          
          {previewData && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="success" sx={{ mb: 2 }}>
                Giltig prislista med {previewData.items.length} produkter.
              </Alert>
              
              {previewData.items.length > 0 && (
                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: '300px' }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>ProductID</TableCell>
                        <TableCell>Size</TableCell>
                        <TableCell align="right">Price</TableCell>
                        <TableCell>Currency</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {previewData.items.slice(0, 10).map((item, idx) => (
                        <TableRow key={idx} hover>
                          <TableCell>{item.productId}</TableCell>
                          <TableCell>{item.size}</TableCell>
                          <TableCell align="right">{item.price}</TableCell>
                          <TableCell>{item.currency}</TableCell>
                        </TableRow>
                      ))}
                      {previewData.items.length > 10 && (
                        <TableRow>
                          <TableCell colSpan={4} align="center">
                            Visar 10 av {previewData.items.length} rader...
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setUploadDialogOpen(false)}
            disabled={uploading}
          >
            Avbryt
          </Button>
          <Button 
            variant="contained" 
            color="primary"
            onClick={uploadPriceList}
            disabled={!csvFile || !previewData || !previewData.valid || !priceListName.trim() || uploading}
          >
            {uploading ? <CircularProgress size={24} /> : "Ladda upp"}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Dialog för att bekräfta borttagning */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Ta bort prislista</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Är du säker på att du vill ta bort prislistan "{priceListToDelete?.name}"? 
            Denna åtgärd kan inte ångras.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            Avbryt
          </Button>
          <Button onClick={deletePriceList} color="error" variant="contained">
            Ta bort
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog för redigering av prislista */}
      <Dialog 
        open={editMode} 
        onClose={handleCloseEditMode}
        fullScreen
      >
        <DialogTitle>
          Redigera prislista: {editingPriceList?.name}
          <IconButton
            aria-label="close"
            onClick={handleCloseEditMode}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {editedData ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Redigera data nedan. Alla ändringar kommer att sparas när du klickar på Spara.
              </Typography>
              
              <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
                <TextField
                  label="Sök"
                  size="small"
                  variant="outlined"
                  value={searchTerm}
                  onChange={(e) => debounceSearch(e.target.value)}
                  sx={{ flexGrow: 1 }}
                  placeholder="Sök på produkt-ID, storlek, pris..."
                />
                
                {selectedRows.length > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="subtitle2">
                      {selectedRows.length} rader valda
                    </Typography>
                    
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                      <InputLabel>Fält att ändra</InputLabel>
                      <Select
                        value={bulkEditField}
                        label="Fält att ändra"
                        onChange={(e) => setBulkEditField(e.target.value)}
                      >
                        {editedData[0] && Object.keys(editedData[0]).map(key => (
                          <MenuItem key={key} value={key}>{key}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    
                    {bulkEditField === 'Price' && (
                      <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel>Typ av ändring</InputLabel>
                        <Select
                          value={bulkEditType}
                          label="Typ av ändring"
                          onChange={(e) => setBulkEditType(e.target.value)}
                        >
                          <MenuItem value="replace">Ersätt med</MenuItem>
                          <MenuItem value="percentage">Ändra med %</MenuItem>
                        </Select>
                      </FormControl>
                    )}
                    
                    <TextField
                      label={bulkEditField === 'Price' && bulkEditType === 'percentage' ? 'Procent (+/-)' : 'Nytt värde'}
                      size="small"
                      variant="outlined"
                      value={bulkEditValue}
                      onChange={(e) => setBulkEditValue(e.target.value)}
                    />
                    
                    <Button 
                      variant="contained" 
                      color="primary"
                      disabled={!bulkEditField || bulkEditValue === ""}
                      onClick={handleBulkEdit}
                    >
                      Uppdatera {selectedRows.length} rader
                    </Button>
                  </Box>
                )}
              </Box>
              
              <Box sx={{ mt: 2, height: 'calc(100vh - 250px)', border: '1px solid rgba(224, 224, 224, 1)', borderRadius: 1 }}>
                <TableContainer 
                  component={Paper} 
                  sx={{ mt: 2, maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}
                >
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox">
                          <Checkbox
                            indeterminate={selectedRows.length > 0 && selectedRows.length < filteredData.length}
                            checked={selectedRows.length === filteredData.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                // Välj alla rader som visas efter filtrering
                                const filteredIndices = filteredData
                                  .map((row) => editedData.indexOf(row))
                                  .filter(index => index !== -1);
                                setSelectedRows(filteredIndices);
                              } else {
                                setSelectedRows([]);
                              }
                            }}
                          />
                        </TableCell>
                        {filteredData[0] && Object.keys(filteredData[0]).map(field => (
                          <TableCell key={field}>{field}</TableCell>
                        ))}
                        <TableCell>Åtgärder</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedData.map((row) => {
                        const rowIndex = editedData.indexOf(row);
                        return (
                          <TableRow key={rowIndex} hover>
                            <TableCell padding="checkbox">
                              <Checkbox
                                checked={selectedRows.includes(rowIndex)}
                                onChange={() => {
                                  setSelectedRows(prev => {
                                    if (prev.includes(rowIndex)) {
                                      return prev.filter(i => i !== rowIndex);
                                    } else {
                                      return [...prev, rowIndex];
                                    }
                                  });
                                }}
                                size="small"
                              />
                            </TableCell>
                            {Object.keys(row).map(field => (
                              <TableCell key={field}>
                                {renderEditControl(row, rowIndex, field)}
                              </TableCell>
                            ))}
                            <TableCell>
                              <IconButton 
                                color="error" 
                                size="small"
                                onClick={() => {
                                  const newData = [...editedData];
                                  newData.splice(rowIndex, 1);
                                  setEditedData(newData);
                                  // Uppdatera också selectedRows om den borttagna raden var markerad
                                  setSelectedRows(prev => prev.filter(i => i !== rowIndex).map(i => i > rowIndex ? i - 1 : i));
                                  setHasEdits(true);
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
              
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Button 
                  variant="outlined" 
                  color="success"
                  onClick={() => {
                    // Lägg till en ny rad med tomma värden
                    const newRow = {};
                    Object.keys(editedData[0]).forEach(key => {
                      newRow[key] = '';
                    });
                    setEditedData([...editedData, newRow]);
                    setHasEdits(true);
                  }}
                >
                  Lägg till rad
                </Button>
                
                <TablePagination
                  component="div"
                  count={filteredData.length}
                  page={page}
                  onPageChange={(e, newPage) => setPage(newPage)}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={(e) => {
                    setRowsPerPage(parseInt(e.target.value, 10));
                    setPage(0);
                  }}
                  rowsPerPageOptions={[10, 25, 50, 100]}
                  labelRowsPerPage="Rader per sida:"
                />
                
                <Box>
                  <Button 
                    variant="outlined" 
                    color="error" 
                    onClick={handleCloseEditMode}
                    disabled={savingEdits}
                    sx={{ mr: 1 }}
                  >
                    Avbryt
                  </Button>
                  <Button 
                    variant="contained" 
                    color="primary"
                    onClick={saveEditedPriceList}
                    disabled={savingEdits}
                  >
                    {savingEdits ? <CircularProgress size={24} /> : "Spara ändringar"}
                  </Button>
                </Box>
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog för att bekräfta avbrytande av redigering */}
      <Dialog
        open={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
      >
        <DialogTitle>Avbryta redigering?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Du har osparade ändringar. Är du säker på att du vill avbryta redigeringen? Alla ändringar kommer att gå förlorade.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelConfirmOpen(false)}>Fortsätt redigera</Button>
          <Button 
            onClick={() => {
              setCancelConfirmOpen(false);
              setEditMode(false);
              setEditingPriceList(null);
              setEditedData(null);
              setHasEdits(false);
            }} 
            color="error"
          >
            Avbryt redigering
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default PriceListManager; 