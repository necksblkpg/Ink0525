import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Tooltip,
  Divider,
  TextField,
  Alert,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox
} from '@mui/material';
import { db } from './firebase';
import { collection, query, orderBy as firestoreOrderBy, getDocs, doc, deleteDoc, addDoc, serverTimestamp, limit, updateDoc } from 'firebase/firestore';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import InfoIcon from '@mui/icons-material/Info';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';

function HanteraPrislistor() {
  const [priceLists, setPriceLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPriceList, setSelectedPriceList] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [priceListToDelete, setPriceListToDelete] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  
  // States för CSV-uppladdning
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [csvFileName, setCsvFileName] = useState("");
  const [priceListName, setPriceListName] = useState("");
  const [uploadError, setUploadError] = useState(null);
  const [showFormatInfo, setShowFormatInfo] = useState(false);
  const [uploadingPriceList, setUploadingPriceList] = useState(false);
  const [parsedData, setParsedData] = useState(null);

  // Lägg till nya state-variabler för redigering
  const [editMode, setEditMode] = useState(false);
  const [editingPriceList, setEditingPriceList] = useState(null);
  const [editedData, setEditedData] = useState(null);
  const [savingEdits, setSavingEdits] = useState(false);

  // Lägg till nya state-variabler för filtrering och bulkredigering
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRows, setSelectedRows] = useState([]);
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [bulkEditValue, setBulkEditValue] = useState("");
  const [bulkEditField, setBulkEditField] = useState("");

  // Lägg till dessa states
  const [hasEdits, setHasEdits] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  // Lägg till state för batch-redigeringstyp
  const [bulkEditType, setBulkEditType] = useState("replace"); // "replace" eller "percentage"

  // Hämta sparade prislistor från Firestore
  const fetchPriceLists = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, "priceLists"), firestoreOrderBy("createdAt", "desc"));
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

  // Öppna bekräftelsedialogruta för borttagning
  const confirmDelete = (priceList) => {
    setPriceListToDelete(priceList);
    setDeleteDialogOpen(true);
  };

  // Ta bort en prislista från Firestore
  const deletePriceList = async () => {
    if (!priceListToDelete) return;
    
    try {
      await deleteDoc(doc(db, "priceLists", priceListToDelete.id));
      setPriceLists(prev => prev.filter(p => p.id !== priceListToDelete.id));
      setDeleteDialogOpen(false);
      setPriceListToDelete(null);
    } catch (error) {
      console.error("Fel vid borttagning av prislista:", error);
      alert(`Fel vid borttagning av prislista: ${error.message}`);
    }
  };

  // Visa detaljer för en prislista
  const showPriceListDetails = (priceList) => {
    setSelectedPriceList(priceList);
    setDetailDialogOpen(true);
  };
  
  // Öppna dialogen för CSV-uppladdning
  const openUploadDialog = () => {
    setUploadDialogOpen(true);
    setCsvFile(null);
    setCsvFileName("");
    setPriceListName("");
    setUploadError(null);
    setParsedData(null);
  };
  
  // Hantera val av CSV-fil
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setCsvFile(null);
      setCsvFileName("");
      setParsedData(null);
      return;
    }
    
    if (!file.name.endsWith('.csv')) {
      setUploadError("Välj en fil med .csv-format");
      setCsvFile(null);
      setCsvFileName("");
      setParsedData(null);
      return;
    }
    
    setCsvFile(file);
    setCsvFileName(file.name);
    setUploadError(null);
    
    // Läs filen för att förhandsgranska och validera
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csvData = event.target.result;
        const { items, valid, error } = parsePriceListCSV(csvData);
        
        if (!valid) {
          setUploadError(error);
          setParsedData(null);
        } else {
          setParsedData({ items });
          
          // Föreslå ett prislistnamn baserat på filnamnet
          if (!priceListName) {
            const baseName = file.name.replace(/\.csv$/i, '');
            setPriceListName(baseName);
          }
        }
      } catch (error) {
        setUploadError(`Fel vid läsning av CSV-filen: ${error.message}`);
        setParsedData(null);
      }
    };
    reader.readAsText(file);
  };
  
  // Tolka CSV-data för prislistor
  const parsePriceListCSV = (csvData) => {
    try {
      // Dela upp rader
      const rows = csvData.split(/\r?\n/).filter(row => row.trim().length > 0);
      if (rows.length < 2) {
        return { valid: false, error: "CSV-filen måste innehålla rubriker och minst en rad med data." };
      }
      
      // Extrahera rubriker (första raden)
      const headers = parseCSVRow(rows[0]);
      
      // Kontrollera att nödvändiga kolumner finns
      const requiredColumns = ["ProductID", "Size", "Price", "Currency"];
      
      const missingColumns = requiredColumns.filter(col => !headers.includes(col));
      if (missingColumns.length > 0) {
        return { 
          valid: false, 
          error: `Saknar obligatoriska kolumner: ${missingColumns.join(", ")}` 
        };
      }
      
      // Bearbeta datarader
      const items = [];
      for (let i = 1; i < rows.length; i++) {
        if (!rows[i].trim()) continue;
        
        const values = parseCSVRow(rows[i]);
        if (values.length !== headers.length) {
          return { 
            valid: false, 
            error: `Rad ${i+1} har ${values.length} värden, men det ska vara ${headers.length} värden.` 
          };
        }
        
        // Skapa ett objekt med data från raden
        const item = {};
        headers.forEach((header, index) => {
          item[header] = values[index];
        });
        
        // Validera obligatoriska fält
        if (!item.ProductID || !item.Size || !item.Price || !item.Currency) {
          return { 
            valid: false, 
            error: `Rad ${i+1} saknar obligatoriska värden.` 
          };
        }
        
        // Validera att priset är ett tal
        if (isNaN(parseFloat(item.Price))) {
          return { 
            valid: false, 
            error: `Rad ${i+1} har ett ogiltigt pris: "${item.Price}". Måste vara ett tal.` 
          };
        }
        
        // Validera valuta
        const validCurrencies = ["SEK", "EUR", "USD", "GBP"];
        if (!validCurrencies.includes(item.Currency)) {
          return { 
            valid: false, 
            error: `Rad ${i+1} har en ogiltig valuta: "${item.Currency}". Måste vara en av: ${validCurrencies.join(", ")}` 
          };
        }
        
        items.push({
          productId: item.ProductID,
          size: item.Size,
          price: parseFloat(item.Price),
          currency: item.Currency
        });
      }
      
      if (items.length === 0) {
        return { valid: false, error: "Inga giltiga priser hittades i filen." };
      }
      
      return { valid: true, items };
    } catch (error) {
      return { valid: false, error: `Fel vid tolkning av CSV: ${error.message}` };
    }
  };
  
  // Tolka rad i CSV-fil (hanterar citattecken och kommatecken)
  const parseCSVRow = (row) => {
    const result = [];
    let current = "";
    let inQuotes = false;
    
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    
    if (current.trim()) {
      result.push(current.trim());
    }
    
    return result;
  };
  
  // Ladda upp prislista till Firestore
  const uploadPriceList = async () => {
    if (!csvFile || !parsedData || !priceListName.trim()) {
      return;
    }
    
    try {
      setUploadingPriceList(true);
      
      // Läs CSV-filen som text
      const csvString = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsText(csvFile);
      });
      
      // Skapa en mappning för enkel sökning av priser
      const priceMap = {};
      parsedData.items.forEach(item => {
        const key = `${item.productId}_${item.size}`;
        priceMap[key] = {
          price: item.price,
          currency: item.currency
        };
      });
      
      // Skapa ett nytt dokument i Firestore
      await addDoc(collection(db, "priceLists"), {
        name: priceListName.trim(),
        createdAt: serverTimestamp(),
        itemCount: parsedData.items.length,
        csvData: csvString,
        items: parsedData.items,
        priceMap  // Sparar mappningen för enkel lookups
      });
      
      // Återställ formuläret och stäng dialogen
      setCsvFile(null);
      setCsvFileName("");
      setPriceListName("");
      setUploadError(null);
      setParsedData(null);
      setUploadDialogOpen(false);
      setUploadingPriceList(false);
      
      // Uppdatera prislistor
      fetchPriceLists();
      
      alert(`Prislistan "${priceListName}" har sparats!`);
    } catch (error) {
      console.error("Fel vid uppladdning av prislista:", error);
      setUploadError(`Fel vid uppladdning: ${error.message}`);
      setUploadingPriceList(false);
    }
  };
  
  // Ladda ner CSV för en prislista
  const downloadCSV = (priceList) => {
    if (!priceList.csvData) return;
    
    const blob = new Blob([priceList.csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${priceList.name.replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Funktion för att starta redigering av en prislista
  const startEditingPriceList = (priceList) => {
    console.log("Startar redigering av prislista:", priceList.name); // För debugging
    setEditingPriceList(priceList);
    
    // Parsera CSV-data till ett redigerbart format om den finns
    if (priceList.csvData) {
      try {
        const rows = priceList.csvData.split('\n');
        const headers = parseCSVRow(rows[0]); // Använd samma funktion som för CSV-parsing
        
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
          return value.includes(',') ? `"${value}"` : value;
        });
        csvRows.push(values.join(','));
      });
      
      const updatedCsvData = csvRows.join('\n');
      
      // Uppdatera dokumentet i Firestore
      const priceListRef = doc(db, "priceLists", editingPriceList.id);
      await updateDoc(priceListRef, {
        csvData: updatedCsvData,
        updatedAt: serverTimestamp(),
        lastEditedBy: "Admin" // Du kan ersätta detta med användarinformation om det finns
      });
      
      // Uppdatera UI och avsluta redigeringsläge
      alert("Prislistan har uppdaterats!");
      setEditMode(false);
      setEditingPriceList(null);
      setEditedData(null);
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

  // Uppdatera funktion för att avsluta redigering
  const handleCloseEditMode = () => {
    if (hasEdits) {
      setCancelConfirmOpen(true);
    } else {
      setEditMode(false);
      setEditingPriceList(null);
      setEditedData(null);
    }
  };

  // Uppdatera när data ändras för att spåra om det finns osparade ändringar
  const handleDataChange = (rowIndex, field, value) => {
    const newData = [...editedData];
    newData[rowIndex][field] = value;
    setEditedData(newData);
    setHasEdits(true);
  };

  // Funktion för att rendera rätt typ av redigeringskontroll baserat på kolumn
  const renderEditControl = (row, rowIndex, field) => {
    // Formatera priser med två decimaler
    if (field === 'Price') {
      return (
        <TextField
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
        <Select
          fullWidth
          size="small"
          value={row[field]}
          onChange={(e) => handleDataChange(rowIndex, field, e.target.value)}
        >
          <MenuItem value="SEK">SEK</MenuItem>
          <MenuItem value="EUR">EUR</MenuItem>
          <MenuItem value="USD">USD</MenuItem>
          <MenuItem value="GBP">GBP</MenuItem>
        </Select>
      );
    }
    
    // Standard textfält för övriga kolumner
    return (
      <TextField
        fullWidth
        size="small"
        variant="outlined"
        value={row[field]}
        onChange={(e) => handleDataChange(rowIndex, field, e.target.value)}
      />
    );
  };

  // Uppdatera batch-redigeringskontrollen
  const handleBulkEdit = () => {
    const newData = [...editedData];
    
    selectedRows.forEach(rowIndex => {
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
    
    setEditedData(newData);
    setBulkEditValue("");
    setSelectedRows([]);
    setHasEdits(true);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">
          Hantera Prislistor
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
        <Box display="flex" justifyContent="center" p={3}>
          <CircularProgress />
        </Box>
      ) : priceLists.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Inga prislistor hittades.</Typography>
          <Button 
            variant="outlined" 
            sx={{ mt: 2 }}
            onClick={openUploadDialog}
          >
            Ladda upp din första prislista
          </Button>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={{ mt: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Prislistans namn</TableCell>
                <TableCell>Skapad</TableCell>
                <TableCell align="right">Antal produkter</TableCell>
                <TableCell align="right">Åtgärder</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {priceLists.map((priceList) => (
                <TableRow key={priceList.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {priceList.name}
                    </Typography>
                  </TableCell>
                  <TableCell>{formatDate(priceList.createdAt)}</TableCell>
                  <TableCell align="right">{priceList.itemCount}</TableCell>
                  <TableCell align="right">
                    <Box display="flex" justifyContent="flex-end" gap={1}>
                      <Tooltip title="Visa detaljer">
                        <Button
                          variant="outlined"
                          size="small"
                          color="primary"
                          onClick={() => setSelectedPriceList(priceList)}
                          startIcon={<VisibilityIcon />}
                        >
                          Visa
                        </Button>
                      </Tooltip>
                      
                      <Tooltip title="Redigera prislista">
                        <Button
                          variant="contained"
                          size="small"
                          color="secondary"
                          onClick={() => startEditingPriceList(priceList)}
                          startIcon={<EditIcon />}
                        >
                          Redigera
                        </Button>
                      </Tooltip>
                      
                      <Tooltip title="Ta bort">
                        <Button
                          variant="outlined"
                          size="small"
                          color="error"
                          onClick={() => setPriceListToDelete(priceList)}
                          startIcon={<DeleteIcon />}
                        >
                          Ta bort
                        </Button>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Dialog för bekräftelse av borttagning */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Ta bort prislista</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Är du säker på att du vill ta bort prislistan "{priceListToDelete?.name}"?
            Detta kan inte återställas.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Avbryt</Button>
          <Button onClick={deletePriceList} color="error">
            Ta bort
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog för prislistedetaljer */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Prislistedetaljer - {selectedPriceList?.name}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Skapad: {selectedPriceList ? formatDate(selectedPriceList.createdAt) : ""}
          </Typography>
          
          <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
            Produkter i prislistan
          </Typography>
          
          <TableContainer component={Paper} sx={{ maxHeight: '60vh' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Produkt-ID</TableCell>
                  <TableCell>Storlek</TableCell>
                  <TableCell align="right">Pris</TableCell>
                  <TableCell>Valuta</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {selectedPriceList?.items?.map((item, index) => (
                  <TableRow key={index} hover>
                    <TableCell>{item.productId}</TableCell>
                    <TableCell>{item.size}</TableCell>
                    <TableCell align="right">{item.price.toFixed(2)}</TableCell>
                    <TableCell>{item.currency}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)}>
            Stäng
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Dialog för CSV-uppladdning */}
      <Dialog 
        open={uploadDialogOpen}
        onClose={() => !uploadingPriceList && setUploadDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Ladda upp prislista</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Ladda upp en CSV-fil med prisinformation för produkter. Filen måste innehålla kolumnerna: ProductID, Size, Price, Currency.
            <Button 
              variant="text" 
              size="small" 
              onClick={() => setShowFormatInfo(!showFormatInfo)}
              endIcon={<InfoIcon />}
              sx={{ ml: 1 }}
            >
              {showFormatInfo ? "Dölj format" : "Visa format"}
            </Button>
          </DialogContentText>
          
          <Collapse in={showFormatInfo}>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                CSV-filen måste innehålla följande kolumner:
              </Typography>
              <Box component="ul" sx={{ pl: 2, mt: 0, mb: 1 }}>
                <li>ProductID (Produkt-ID från Centra)</li>
                <li>Size (Storlek)</li>
                <li>Price (Pris)</li>
                <li>Currency (Valuta: SEK, EUR, USD eller GBP)</li>
              </Box>
              <Typography variant="body2">
                Exempelfil: <code>ProductID,Size,Price,Currency</code>
              </Typography>
            </Alert>
          </Collapse>
          
          {uploadError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {uploadError}
            </Alert>
          )}
          
          <Box sx={{ mb: 3 }}>
            <Button
              variant="contained"
              component="label"
              startIcon={<CloudUploadIcon />}
              sx={{ mb: 2 }}
            >
              Välj CSV-fil
              <input
                type="file"
                accept=".csv"
                hidden
                onChange={handleFileChange}
                disabled={uploadingPriceList}
              />
            </Button>
            
            {csvFileName && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                Vald fil: <strong>{csvFileName}</strong>
              </Typography>
            )}
            
            {parsedData && (
              <Alert severity="success" sx={{ mt: 2 }}>
                Giltig prislista med {parsedData.items.length} produkter.
              </Alert>
            )}
          </Box>
          
          <Divider sx={{ my: 2 }} />
          
          <TextField
            margin="dense"
            label="Prislistans namn"
            fullWidth
            variant="outlined"
            value={priceListName}
            onChange={(e) => setPriceListName(e.target.value)}
            disabled={uploadingPriceList}
            sx={{ mb: 2 }}
            required
          />
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setUploadDialogOpen(false)}
            disabled={uploadingPriceList}
          >
            Avbryt
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={uploadPriceList}
            disabled={!csvFile || !parsedData || !priceListName.trim() || uploadingPriceList}
          >
            {uploadingPriceList ? <CircularProgress size={24} /> : "Ladda upp"}
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
                  onChange={(e) => setSearchTerm(e.target.value)}
                  sx={{ flexGrow: 1 }}
                  placeholder="Sök på produkt-ID, storlek, pris..."
                />
                
                {selectedRows.length > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2, mb: 2 }}>
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
                        {Object.keys(editedData[0]).map(key => (
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
              
              <TableContainer component={Paper} sx={{ mt: 2, maxHeight: 'calc(100vh - 250px)' }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          indeterminate={selectedRows.length > 0 && selectedRows.length < editedData.length}
                          checked={selectedRows.length === editedData.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              // Välj alla rader som visas efter filtrering
                              const filteredIndices = editedData
                                .map((row, index) => {
                                  if (!searchTerm) return index;
                                  const rowText = Object.values(row).join(' ').toLowerCase();
                                  return rowText.includes(searchTerm.toLowerCase()) ? index : null;
                                })
                                .filter(index => index !== null);
                              setSelectedRows(filteredIndices);
                            } else {
                              setSelectedRows([]);
                            }
                          }}
                        />
                      </TableCell>
                      {Object.keys(editedData[0]).map(field => (
                        <TableCell key={field}>
                          {renderEditControl(editedData[field], field, field)}
                        </TableCell>
                      ))}
                      <TableCell>Åtgärder</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {editedData.map((row, rowIndex) => {
                      // Filtrera rader baserat på söktermer
                      if (searchTerm) {
                        const rowText = Object.values(row).join(' ').toLowerCase();
                        if (!rowText.includes(searchTerm.toLowerCase())) {
                          return null;
                        }
                      }
                    
                      return (
                        <TableRow key={rowIndex}>
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
              
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
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
                  }}
                >
                  Lägg till rad
                </Button>
                
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

export default HanteraPrislistor; 