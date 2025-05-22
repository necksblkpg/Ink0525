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
  Chip,
  Divider,
  TextField,
  Alert,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Grid
} from '@mui/material';
import { db } from './firebase';
import { collection, query, orderBy as firestoreOrderBy, getDocs, doc, deleteDoc, addDoc, serverTimestamp, getDoc, limit } from 'firebase/firestore';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import InfoIcon from '@mui/icons-material/Info';
import PriceListStatus from './components/PriceListStatus';

function HanteraInkopsOrder() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  
  // Nya states för CSV-uppladdning
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [csvFileName, setCsvFileName] = useState("");
  const [orderNameFromUpload, setOrderNameFromUpload] = useState("");
  const [orderNoteFromUpload, setOrderNoteFromUpload] = useState("");
  const [uploadError, setUploadError] = useState(null);
  const [showFormatInfo, setShowFormatInfo] = useState(false);
  const [uploadingOrder, setUploadingOrder] = useState(false);
  const [parsedData, setParsedData] = useState(null);

  // Nya states för inleverans
  const [receivingDialogOpen, setReceivingDialogOpen] = useState(false);
  const [receivingOrder, setReceivingOrder] = useState(null);
  const [receivedQuantities, setReceivedQuantities] = useState({});
  const [receivingCurrency, setReceivingCurrency] = useState('EUR');
  const [exchangeRate, setExchangeRate] = useState(11.5); // Default EUR till SEK
  const [customsDutyPercent, setCustomsDutyPercent] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [processingReceiving, setProcessingReceiving] = useState(false);
  const [stockLevels, setStockLevels] = useState({});
  const [newUnitCosts, setNewUnitCosts] = useState({});

  // Ny state
  const [priceLists, setPriceLists] = useState([]);
  const [selectedPriceList, setSelectedPriceList] = useState(null);
  const [loadingPriceLists, setLoadingPriceLists] = useState(false);

  // Hämta sparade ordrar från Firestore
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, "purchaseOrders"), firestoreOrderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      
      const fetchedOrders = [];
      querySnapshot.forEach((doc) => {
        fetchedOrders.push({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date()
        });
      });
      
      setOrders(fetchedOrders);
      setLoading(false);
    } catch (error) {
      console.error("Fel vid hämtning av ordrar:", error);
      setLoading(false);
    }
  };

  // Hämta ordrar när komponenten laddas
  useEffect(() => {
    fetchOrders();
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

  // Ladda ner CSV för en order
  const downloadCSV = (order) => {
    if (!order.csvData) return;
    
    const blob = new Blob([order.csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${order.name.replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Öppna bekräftelsedialogruta för borttagning
  const confirmDelete = (order) => {
    setOrderToDelete(order);
    setDeleteDialogOpen(true);
  };

  // Ta bort en order från Firestore
  const deleteOrder = async () => {
    if (!orderToDelete) return;
    
    try {
      await deleteDoc(doc(db, "purchaseOrders", orderToDelete.id));
      setOrders(prev => prev.filter(o => o.id !== orderToDelete.id));
      setDeleteDialogOpen(false);
      setOrderToDelete(null);
    } catch (error) {
      console.error("Fel vid borttagning av order:", error);
      alert(`Fel vid borttagning av order: ${error.message}`);
    }
  };

  // Visa detaljer för en order
  const showOrderDetails = (order) => {
    setSelectedOrder(order);
    setDetailDialogOpen(true);
  };
  
  // Öppna dialogen för CSV-uppladdning
  const openUploadDialog = () => {
    setUploadDialogOpen(true);
    setCsvFile(null);
    setCsvFileName("");
    setOrderNameFromUpload("");
    setOrderNoteFromUpload("");
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
        const { headers, items, valid, error } = parseCSV(csvData);
        
        if (!valid) {
          setUploadError(error);
          setParsedData(null);
        } else {
          setParsedData({ headers, items });
          
          // Föreslå ett ordernamn baserat på filnamnet
          if (!orderNameFromUpload) {
            const baseName = file.name.replace(/\.csv$/i, '');
            setOrderNameFromUpload(baseName);
          }
        }
      } catch (error) {
        setUploadError(`Fel vid läsning av CSV-filen: ${error.message}`);
        setParsedData(null);
      }
    };
    reader.readAsText(file);
  };
  
  // Tolka CSV-data
  const parseCSV = (csvData) => {
    try {
      // Dela upp rader
      const rows = csvData.split(/\r?\n/).filter(row => row.trim().length > 0);
      if (rows.length < 2) {
        return { valid: false, error: "CSV-filen måste innehålla rubriker och minst en rad med data." };
      }
      
      // Extrahera rubriker (första raden)
      const headers = parseCSVRow(rows[0]);
      
      // Kontrollera att nödvändiga kolumner finns
      const requiredColumns = [
        "ProductID", "Product Number", "Product Name", "Size", "Unit Cost", "Quantity to Order"
      ];
      
      const missingColumns = requiredColumns.filter(col => !headers.includes(col));
      if (missingColumns.length > 0) {
        return { 
          valid: false, 
          error: `Saknade kolumner i CSV-filen: ${missingColumns.join(", ")}` 
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
            error: `Rad ${i+1} har felaktigt antal kolumner. Förväntade ${headers.length} men fick ${values.length}.` 
          };
        }
        
        // Skapa objekt från rubriker och värden
        const item = {};
        headers.forEach((header, index) => {
          item[header] = values[index];
        });
        
        // Konvertera till rätt format
        items.push({
          product_id: `${item["ProductID"]}_${item["Size"]}`,
          productId: item["ProductID"], // Säkerställ att vi har original ProductID
          productNumber: item["Product Number"],
          productName: item["Product Name"],
          supplier: item["Supplier"] || "-",
          size: item["Size"],
          unitCost: parseFloat(item["Unit Cost"]) || 0,
          quantity: parseInt(item["Quantity to Order"], 10) || 0
        });
      }
      
      return { valid: true, headers, items };
    } catch (error) {
      return { valid: false, error: `Fel vid parsning av CSV: ${error.message}` };
    }
  };
  
  // Hjälpfunktion för att hantera citerade CSV-värden korrekt
  const parseCSVRow = (row) => {
    const result = [];
    let inQuotes = false;
    let currentValue = "";
    
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      
      if (char === '"' && (i === 0 || row[i-1] !== '\\')) {
        inQuotes = !inQuotes;
        continue;
      }
      
      if (char === ',' && !inQuotes) {
        result.push(currentValue.trim());
        currentValue = "";
        continue;
      }
      
      currentValue += char;
    }
    
    // Lägg till det sista värdet
    result.push(currentValue.trim());
    return result;
  };
  
  // Skapa en CSV-sträng från tolkad data
  const createCSVString = (headers, items) => {
    const rows = [
      headers.join(','),
      ...items.map(item => [
        item.product_id,
        item.productNumber,
        `"${item.productName}"`, // Citera namn ifall de innehåller kommatecken
        item.supplier,
        item.collection,
        item.stock,
        item.size,
        item.unitCost,
        item.quantity
      ].join(','))
    ];
    
    return rows.join('\n');
  };
  
  // Spara den uppladdade CSV-filen som en ny order
  const uploadCSVOrder = async () => {
    if (!csvFile || !parsedData || !orderNameFromUpload.trim()) {
      setUploadError("Välj en giltig CSV-fil och ange ett ordernamn");
      return;
    }
    
    try {
      setUploadingOrder(true);
      
      const { items } = parsedData;
      
      // Beräkna sammanfattande statistik
      const totalItems = items.length;
      const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
      const totalCost = items.reduce((sum, item) => sum + item.totalCost, 0);
      
      // Generera CSV-data för lagring
      const csvString = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsText(csvFile);
      });
      
      // Skapa ett nytt dokument i Firestore
      await addDoc(collection(db, "purchaseOrders"), {
        name: orderNameFromUpload.trim(),
        note: orderNoteFromUpload,
        supplier: "Manuellt uppladdad", // Sätt en standardleverantör för uppladdade ordrar
        collection: "Manuellt uppladdad",
        createdAt: serverTimestamp(),
        totalItems,
        totalQuantity,
        totalCost,
        csvData: csvString,
        items,
        uploadedFile: csvFileName
      });
      
      // Återställ formuläret och stäng dialogen
      setCsvFile(null);
      setCsvFileName("");
      setOrderNameFromUpload("");
      setOrderNoteFromUpload("");
      setUploadError(null);
      setParsedData(null);
      setUploadDialogOpen(false);
      setUploadingOrder(false);
      
      // Uppdatera orderlistan
      fetchOrders();
      
      alert(`Inköpsorder "${orderNameFromUpload}" har sparats!`);
    } catch (error) {
      console.error("Fel vid uppladdning av order:", error);
      setUploadError(`Fel vid uppladdning: ${error.message}`);
      setUploadingOrder(false);
    }
  };

  // Öppna dialogrutan för inleverans
  const openReceivingDialog = async (order) => {
    setReceivingOrder(order);
    
    // Förbered state för mottagna kvantiteter (default = beställd kvantitet)
    const quantities = {};
    const costs = {};
    
    // Hämta aktuellt lagersaldo för alla produkter i ordern
    try {
      setProcessingReceiving(true);
      
      // Hämta prislistor om det inte redan gjorts
      if (priceLists.length === 0) {
        fetchPriceLists();
      }
      
      const productIds = order.items.map(item => item.productId).filter(id => id);
      
      if (productIds.length === 0) {
        throw new Error("Inköpsordern saknar giltiga produkt-ID:n");
      }
      
      // Hämta produktinformation direkt från Centra API
      const stockData = await fetch('https://flask-backend-400816870138.europe-north1.run.app/product-info', { 
        mode: 'cors'
      })
        .then(res => {
          if (!res.ok) throw new Error("Kunde inte hämta produktinformation från Centra");
          return res.json();
        })
        .then(data => data.data || []);
      
      // Skapa en mappning av produkt-ID till lagersaldo och nuvarande pris
      const stockMap = {};
      stockData.forEach(item => {
        if (item.product_id) {
          // Hämta storleksinformation
          const sizeInfo = parseSizeInfo(item.productSizeInfo || "");
          
          // Registrera basprodukten för kompatibilitet bakåt 
          stockMap[item.product_id] = {
            stock: parseFloat(item.totalPhysicalQuantity || 0),
            unitCost: parseFloat(item.unitCost || 0)
          };
          
          // Registrera även per storlek om det finns storleksinformation
          if (sizeInfo && sizeInfo.length > 0) {
            sizeInfo.forEach(sizeData => {
              const sizeKey = `${item.product_id}_${sizeData.size}`;
              stockMap[sizeKey] = {
                stock: sizeData.stock || Math.round(parseFloat(item.totalPhysicalQuantity || 0) / sizeInfo.length),
                unitCost: parseFloat(item.unitCost || 0)
              };
            });
          }
        }
      });
      
      // För varje produkt i ordern, förbered defaultvärden
      order.items.forEach(item => {
        if (!item.productId) {
          console.warn("Produkt saknar ID:", item);
          return;
        }
        
        // För mottagna kvantiteter, använd beställd kvantitet som default
        quantities[item.productId] = item.quantity;
        
        // Originalpris är alltid i SEK
        costs[item.productId] = item.unitCost;
      });
      
      setStockLevels(stockMap);
      setReceivedQuantities(quantities);
      setNewUnitCosts(costs);
      setProcessingReceiving(false);
      
      // Öppna dialogrutan
      setReceivingDialogOpen(true);
    } catch (error) {
      console.error("Fel vid hämtning av lagersaldo:", error);
      alert(`Fel: ${error.message}`);
      setProcessingReceiving(false);
    }
  };
  
  // Beräkna nya enhetskostnader baserat på viktad genomsnittsberäkning
  const calculateNewUnitCosts = () => {
    if (!receivingOrder || !receivingOrder.items) return;
    
    // Om ingen prislista är vald, använd bara de befintliga priserna
    if (!selectedPriceList || !selectedPriceList.priceMap) {
      const newCosts = {};
      receivingOrder.items.forEach(item => {
        if (!item.productId) return;
        const stockInfo = stockLevels[item.productId] || { stock: 0, unitCost: 0 };
        newCosts[item.productId] = stockInfo.unitCost;
      });
      setNewUnitCosts(newCosts);
      return;
    }
    
    const newCosts = {};
    
    // Gå igenom varje produkt och beräkna nytt snittpris
    receivingOrder.items.forEach(item => {
      if (!item.productId) return;
      
      const receivedQty = receivedQuantities[item.productId] || 0;
      if (receivedQty <= 0) {
        newCosts[item.productId] = item.unitCost;
        return;
      }
      
      // Hämta aktuellt lagersaldo och pris
      const sizeKey = `${item.productId}_${item.size}`;
      const stockInfo = stockLevels[sizeKey] || stockLevels[item.productId] || { stock: 0, unitCost: 0 };
      const currentStock = stockInfo.stock;
      const currentCost = stockInfo.unitCost;
      
      // Försök hämta pris från prislistan
      const priceKey = `${item.productId}_${item.size}`;
      const priceInfo = selectedPriceList.priceMap[priceKey];
      
      // Om priset inte finns i prislistan, använd det gamla priset
      if (!priceInfo) {
        console.log(`Inget pris hittades i prislistan för ${item.productId}_${item.size}, använder befintligt pris`);
        newCosts[item.productId] = currentCost;
        return;
      } else {
        console.log(`Använder pris från prislistan för ${item.productId}_${item.size}: ${priceInfo.price} ${priceInfo.currency}`);
      }
      
      // Beräkna kostnad per enhet för de mottagna produkterna
      // Konvertera från främmande valuta till SEK och lägg till tull och frakt proportionellt
      let receivedUnitCostInSEK;
      
      if (priceInfo.currency === "SEK") {
        receivedUnitCostInSEK = priceInfo.price;
      } else {
        // Konvertera till SEK med angiven växelkurs
        const currencyRate = priceInfo.currency === receivingCurrency ? exchangeRate : 
                           (receivingCurrency === "SEK" ? 1 : exchangeRate); // Fallback
        receivedUnitCostInSEK = priceInfo.price * currencyRate;
      }
      
      // Lägg till tull
      receivedUnitCostInSEK *= (1 + (customsDutyPercent / 100));
      
      // Lägg till andel av frakt (proportionellt fördelat)
      const totalReceivedValue = receivingOrder.items.reduce((sum, i) => {
        const qty = receivedQuantities[i.productId] || 0;
        if (qty <= 0) return sum;
        
        // Hämta pris från prislistan för denna produkt också
        const iPriceKey = `${i.productId}_${i.size}`;
        const iPriceInfo = selectedPriceList.priceMap[iPriceKey];
        if (!iPriceInfo) return sum;
        
        let iPrice = iPriceInfo.price;
        if (iPriceInfo.currency !== "SEK") {
          const iCurrencyRate = iPriceInfo.currency === receivingCurrency ? exchangeRate : 
                             (receivingCurrency === "SEK" ? 1 : exchangeRate);
          iPrice *= iCurrencyRate;
        }
        
        return sum + (qty * iPrice);
      }, 0);
      
      if (totalReceivedValue > 0) {
        const fractionOfTotal = (receivedQty * receivedUnitCostInSEK) / totalReceivedValue;
        const shippingPerUnit = (parseFloat(shippingCost) * fractionOfTotal) / receivedQty;
        receivedUnitCostInSEK += shippingPerUnit;
      }
      
      // Beräkna nytt snittpris med viktad genomsnittsberäkning
      if (currentStock <= 0) {
        // Om inget befintligt lager, använd bara det nya priset
        newCosts[item.productId] = receivedUnitCostInSEK;
      } else {
        // Viktad genomsnittsberäkning
        const totalValue = (currentStock * currentCost) + (receivedQty * receivedUnitCostInSEK);
        const totalQuantity = currentStock + receivedQty;
        newCosts[item.productId] = totalValue / totalQuantity;
      }
      
      // Avrunda till två decimaler
      newCosts[item.productId] = Math.round(newCosts[item.productId] * 100) / 100;
    });
    
    setNewUnitCosts(newCosts);
  };
  
  // Hantera ändring av mottagen kvantitet
  const handleReceivedQuantityChange = (productId, value) => {
    const newQty = parseInt(value, 10) || 0;
    setReceivedQuantities(prev => ({
      ...prev,
      [productId]: newQty
    }));
  };
  
  // Ladda ner CSV med nya enhetskostnader
  const downloadNewUnitCostCSV = () => {
    if (!receivingOrder || !receivingOrder.items) return;
    
    // Skapa CSV-innehåll med mer metadata
    const metadata = [
      ["# Genererad:", new Date().toLocaleString('sv-SE')],
      ["# Order:", receivingOrder.name],
      ["# Valuta:", receivingCurrency],
      ["# Växelkurs:", receivingCurrency === "SEK" ? "1" : exchangeRate.toString()],
      ["# Tull (%):", customsDutyPercent.toString()],
      ["# Frakt (SEK):", shippingCost.toString()],
      ["# Prislista:", selectedPriceList ? selectedPriceList.name : "Ingen"],
      ["# Import till Centra:", "Behåll endast kolumnerna ProductID, SKU, Cost/Pcs"]
    ];
    
    // Lämna en tom rad efter metadata
    const headers = ["ProductID", "SKU", "Cost/Pcs", "Size", "Old Unit Cost", "Price Source", "Received Qty", "Current Stock"];
    
    const rows = receivingOrder.items
      .filter(item => item.productId && (receivedQuantities[item.productId] || 0) > 0)
      .map(item => {
        const priceKey = `${item.productId}_${item.size}`;
        const priceInfo = selectedPriceList?.priceMap?.[priceKey];
        const stockInfo = stockLevels[item.productId] || { stock: 0, unitCost: 0 };
        const newCost = newUnitCosts[item.productId]?.toFixed(2) || stockInfo.unitCost.toFixed(2);
        const oldCost = stockInfo.unitCost.toFixed(2);
        const priceSource = priceInfo ? `Prislista (${priceInfo.currency})` : "Befintligt pris";
        
        return [
          item.productId,
          item.productNumber || "",
          newCost,
          item.size || "",
          oldCost,
          priceSource,
          receivedQuantities[item.productId] || "0",
          Math.round(stockInfo.stock)
        ];
      });
    
    // Sammanfoga till CSV med metadata
    const csvContent = [
      ...metadata,
      [""],  // Tom rad mellan metadata och data
      headers,
      ...rows
    ].map(row => row.map(cell => {
      // Kapsla in celler med kommatecken i citattecken
      if (cell && cell.toString().includes(',')) {
        return `"${cell}"`;
      }
      return cell;
    }).join(',')).join('\n');
    
    // Skapa och ladda ner filen
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `nya_priser_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Uppdatera beräkningar när relevanta värden ändras
  useEffect(() => {
    if (receivingDialogOpen) {
      calculateNewUnitCosts();
    }
  }, [receivingCurrency, exchangeRate, customsDutyPercent, shippingCost, receivedQuantities, receivingDialogOpen]);

  // Funktion för att hämta prislistor
  const fetchPriceLists = async () => {
    try {
      setLoadingPriceLists(true);
      const q = query(collection(db, "priceLists"), firestoreOrderBy("createdAt", "desc"), limit(10));
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
      
      // Om det finns prislistor, välj den senaste som standard
      if (fetchedPriceLists.length > 0) {
        setSelectedPriceList(fetchedPriceLists[0]);
      }
      
      setLoadingPriceLists(false);
    } catch (error) {
      console.error("Fel vid hämtning av prislistor:", error);
      setLoadingPriceLists(false);
    }
  };

  // Hämta prislistor när komponenten laddas
  useEffect(() => {
    fetchPriceLists();
  }, []);

  // Lägg till en hjälpfunktion för att tolka storleksinformation 
  const parseSizeInfo = (sizeInfoStr) => {
    if (!sizeInfoStr) return [{ size: "One Size", stock: 0 }];
    
    // Rensa och normalisera storlekssträngen
    const cleanSizeInfo = sizeInfoStr.trim();
    
    // Om det redan är en enkel storlek, returnera den direkt
    if (cleanSizeInfo === "One Size" || 
        cleanSizeInfo === "Universal" || 
        cleanSizeInfo === "N/A") {
      return [{ size: cleanSizeInfo, stock: 0 }];
    }
    
    // Hantera storleksformat med kolon (t.ex. "XS:31")
    if (cleanSizeInfo.includes(':')) {
      const parts = cleanSizeInfo.split(':');
      if (parts.length === 2 && !isNaN(parts[1])) {
        return [{ 
          size: parts[0].trim(), 
          stock: parseInt(parts[1].trim(), 10) || 0 
        }];
      }
    }
    
    // Kontrollera om strängen innehåller separatorer som kan indikera flera storlekar
    if (cleanSizeInfo.includes(',') || 
        cleanSizeInfo.includes('/') || 
        cleanSizeInfo.includes(';') || 
        cleanSizeInfo.includes(' - ')) {
      // Dela upp baserat på vanliga separatorer
      const sizes = cleanSizeInfo
        .split(/[,\/;]|-/)
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .map(s => {
          // Kontrollera om denna del innehåller kolon (storlek:lagersaldo)
          if (s.includes(':')) {
            const [sizeVal, stockVal] = s.split(':');
            return { 
              size: sizeVal.trim(), 
              stock: parseInt(stockVal.trim(), 10) || 0 
            };
          }
          return { size: s, stock: 0 };
        });
      
      if (sizes.length > 0) return sizes;
    }
    
    // Om inga separatorer hittades, men storleken innehåller mellanslag,
    // kan det vara en lista av storlekar (t.ex. "S M L XL")
    if (cleanSizeInfo.includes(' ')) {
      const potentialSizes = cleanSizeInfo.split(' ')
        .filter(s => s.length > 0)
        .map(s => {
          // Kontrollera om denna del innehåller kolon (storlek:lagersaldo)
          if (s.includes(':')) {
            const [sizeVal, stockVal] = s.split(':');
            return { 
              size: sizeVal.trim(), 
              stock: parseInt(stockVal.trim(), 10) || 0 
            };
          }
          return { size: s, stock: 0 };
        });
      
      // Om varje del är en kort storleksbeteckning (t.ex. S, M, L, XL)
      if (potentialSizes.every(s => s.size.length <= 3)) {
        return potentialSizes;
      }
    }
    
    // Fallback: returnera hela strängen som en storlek
    return [{ size: cleanSizeInfo, stock: 0 }];
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">
          Hantera Inköpsorder
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<CloudUploadIcon />}
          onClick={openUploadDialog}
        >
          Ladda upp CSV
        </Button>
      </Box>
      
      {loading ? (
        <Box display="flex" justifyContent="center" p={3}>
          <CircularProgress />
        </Box>
      ) : orders.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Inga inköpsordrar hittades.</Typography>
          <Button 
            variant="outlined" 
            sx={{ mt: 2 }}
            onClick={openUploadDialog}
          >
            Ladda upp din första inköpsorder
          </Button>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={{ mt: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Ordernamn</TableCell>
                <TableCell>Skapad</TableCell>
                <TableCell align="right">Antal Produkter</TableCell>
                <TableCell align="right">Åtgärder</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {order.name}
                    </Typography>
                    {order.note && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {order.note.length > 50 ? `${order.note.substring(0, 50)}...` : order.note}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(order.createdAt)}</TableCell>
                  <TableCell align="right">{order.totalItems}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Visa detaljer">
                      <IconButton 
                        color="primary" 
                        size="small"
                        onClick={() => showOrderDetails(order)}
                      >
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Ladda ner CSV">
                      <IconButton 
                        color="primary" 
                        size="small"
                        onClick={() => downloadCSV(order)}
                      >
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Registrera inleverans">
                      <IconButton 
                        color="success" 
                        size="small"
                        onClick={() => openReceivingDialog(order)}
                      >
                        <LocalShippingIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Ta bort">
                      <IconButton 
                        color="error" 
                        size="small"
                        onClick={() => confirmDelete(order)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
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
        <DialogTitle>Ta bort inköpsorder</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Är du säker på att du vill ta bort inköpsordern "{orderToDelete?.name}"?
            Detta kan inte återställas.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Avbryt</Button>
          <Button onClick={deleteOrder} color="error">
            Ta bort
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog för orderdetaljer */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Orderdetaljer - {selectedOrder?.name}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Skapad: {selectedOrder ? formatDate(selectedOrder.createdAt) : ""}
          </Typography>
          
          {selectedOrder?.note && (
            <Typography variant="body2" sx={{ mt: 1, mb: 2 }}>
              <strong>Noteringar:</strong> {selectedOrder.note}
            </Typography>
          )}
          
          <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
            Produkter i ordern
          </Typography>
          
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ProductID</TableCell>
                  <TableCell>Produktnummer</TableCell>
                  <TableCell>Produktnamn</TableCell>
                  <TableCell>Leverantör</TableCell>
                  <TableCell>Storlek</TableCell>
                  <TableCell align="right">Styckpris</TableCell>
                  <TableCell align="right">Antal</TableCell>
                  <TableCell align="right">Totalt</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {selectedOrder?.items.map((item, index) => (
                  <TableRow key={index} hover>
                    <TableCell>{item.productId || "-"}</TableCell>
                    <TableCell>{item.productNumber}</TableCell>
                    <TableCell>{item.productName}</TableCell>
                    <TableCell>{item.supplier}</TableCell>
                    <TableCell>{item.size}</TableCell>
                    <TableCell align="right">{item.unitCost.toFixed(2)}</TableCell>
                    <TableCell align="right">{item.quantity}</TableCell>
                    <TableCell align="right">{(item.unitCost * item.quantity).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                
                <TableRow>
                  <TableCell colSpan={7} align="right" sx={{ fontWeight: 'bold' }}>
                    Total:
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    {selectedOrder?.totalCost?.toFixed(2) || "0.00"} SEK
                  </TableCell>
                </TableRow>
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
        onClose={() => !uploadingOrder && setUploadDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Ladda upp CSV-fil för inköpsorder</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Ladda upp en CSV-fil för att skapa en ny inköpsorder.
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
                <li>ProductID</li>
                <li>Product Number</li>
                <li>Product Name</li>
                <li>Supplier</li>
                <li>Collection</li>
                <li>Stock</li>
                <li>Size</li>
                <li>Unit Cost</li>
                <li>Quantity to Order</li>
              </Box>
              <Typography variant="body2">
                Exempelfil: <code>ProductID,Product Number,Product Name,Supplier,Collection,Stock,Size,Unit Cost,Quantity to Order</code>
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
                disabled={uploadingOrder}
              />
            </Button>
            
            {csvFileName && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                Vald fil: <strong>{csvFileName}</strong>
              </Typography>
            )}
            
            {parsedData && (
              <Alert severity="success" sx={{ mt: 2 }}>
                Filen innehåller {parsedData.items.length} giltiga produktrader.
              </Alert>
            )}
          </Box>
          
          <Divider sx={{ my: 2 }} />
          
          <TextField
            margin="dense"
            label="Ordernamn"
            fullWidth
            variant="outlined"
            value={orderNameFromUpload}
            onChange={(e) => setOrderNameFromUpload(e.target.value)}
            disabled={uploadingOrder}
            sx={{ mb: 2 }}
            required
          />
          
          <TextField
            margin="dense"
            label="Noteringar (valfritt)"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={orderNoteFromUpload}
            onChange={(e) => setOrderNoteFromUpload(e.target.value)}
            disabled={uploadingOrder}
          />
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setUploadDialogOpen(false)}
            disabled={uploadingOrder}
          >
            Avbryt
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={uploadCSVOrder}
            disabled={!csvFile || !parsedData || !orderNameFromUpload.trim() || uploadingOrder}
          >
            {uploadingOrder ? <CircularProgress size={24} /> : "Ladda upp"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Ny dialog för inleverans */}
      <Dialog
        open={receivingDialogOpen}
        onClose={() => !processingReceiving && setReceivingDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Registrera inleverans: {receivingOrder?.name}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 3 }}>
            Registrera mottagna produkter och generera en CSV-fil med uppdaterade enhetskostnader.
          </DialogContentText>
          
          {/* Formulär för valuta, tull och fraktkostnader */}
          <Paper sx={{ p: 2, mb: 3 }} elevation={1}>
            <Typography variant="subtitle1" gutterBottom>
              Kostnadsinformation
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth variant="outlined" size="small">
                  <InputLabel>Prislista</InputLabel>
                  <Select
                    value={selectedPriceList ? selectedPriceList.id : ''}
                    onChange={(e) => {
                      const selected = priceLists.find(pl => pl.id === e.target.value);
                      setSelectedPriceList(selected || null);
                    }}
                    label="Prislista"
                  >
                    <MenuItem value="">Ingen prislista vald</MenuItem>
                    {priceLists.map(priceList => (
                      <MenuItem key={priceList.id} value={priceList.id}>
                        {priceList.name} ({formatDate(priceList.createdAt)})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                {loadingPriceLists ? (
                  <Box display="flex" alignItems="center">
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    <Typography variant="body2">Laddar prislistor...</Typography>
                  </Box>
                ) : (
                  <Alert severity={selectedPriceList ? "success" : "info"} sx={{ height: '100%', display: 'flex', alignItems: 'center' }}>
                    {selectedPriceList 
                      ? `Vald prislista: ${selectedPriceList.name} med ${selectedPriceList.itemCount} produkter`
                      : "Välj en prislista för att beräkna nya priser"}
                  </Alert>
                )}
              </Grid>

              {/* Ny sektion som visar detaljer om prislistan */}
              {selectedPriceList && receivingOrder && (
                <Grid item xs={12}>
                  <PriceListStatus 
                    items={receivingOrder.items} 
                    priceMap={selectedPriceList.priceMap}
                    title={`Prisinformation från ${selectedPriceList.name}`}
                  />
                </Grid>
              )}
              
              <Grid item xs={12} sm={3}>
                <FormControl fullWidth variant="outlined" size="small">
                  <InputLabel>Valuta</InputLabel>
                  <Select
                    value={receivingCurrency}
                    onChange={(e) => setReceivingCurrency(e.target.value)}
                    label="Valuta"
                  >
                    <MenuItem value="SEK">SEK</MenuItem>
                    <MenuItem value="EUR">EUR</MenuItem>
                    <MenuItem value="USD">USD</MenuItem>
                    <MenuItem value="GBP">GBP</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={3}>
                <TextField
                  label="Växelkurs till SEK"
                  fullWidth
                  variant="outlined"
                  size="small"
                  type="number"
                  InputProps={{
                    startAdornment: receivingCurrency !== "SEK" ? (
                      <InputAdornment position="start">1 {receivingCurrency} =</InputAdornment>
                    ) : null,
                    endAdornment: receivingCurrency !== "SEK" ? (
                      <InputAdornment position="end">SEK</InputAdornment>
                    ) : null,
                  }}
                  value={receivingCurrency === "SEK" ? 1 : exchangeRate}
                  onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)}
                  disabled={receivingCurrency === "SEK"}
                />
              </Grid>
              
              <Grid item xs={12} sm={3}>
                <TextField
                  label="Tull (%)"
                  fullWidth
                  variant="outlined"
                  size="small"
                  type="number"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>
                  }}
                  value={customsDutyPercent}
                  onChange={(e) => setCustomsDutyPercent(parseFloat(e.target.value) || 0)}
                />
              </Grid>
              
              <Grid item xs={12} sm={3}>
                <TextField
                  label="Fraktkostnad"
                  fullWidth
                  variant="outlined"
                  size="small"
                  type="number"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">SEK</InputAdornment>
                  }}
                  value={shippingCost}
                  onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                />
              </Grid>
            </Grid>
          </Paper>
          
          {/* Ändra i DialogContent för mottagningsdialogrutan, lägg till efter kostnadsinformation men före tabellen */}
          <Paper sx={{ p: 2, mb: 3 }} elevation={1}>
            <Typography variant="subtitle1" gutterBottom>
              Beräkningsmetod för nya priser
            </Typography>
            <Typography variant="body2" paragraph>
              Nedanstående produkters priser beräknas enligt följande viktade genomsnittsmetod:
            </Typography>
            <Box sx={{ bgcolor: '#f8f9fa', p: 2, borderRadius: 1, fontFamily: 'monospace', fontSize: '0.9rem', mb: 2 }}>
              <Typography variant="body2" component="div" sx={{ whiteSpace: 'pre-wrap' }}>
                {`Om aktuellt lager är 0:
  Nytt pris = Pris från prislistan (med valutaomvandling, tull och frakt)
                
Annars:
  Nytt pris = (Nuvarande lager × Nuvarande pris + Mottagna antal × Pris från prislistan) / (Nuvarande lager + Mottagna antal)
                
Pris från prislistan beräknas som:
  Pris = Grundpris × Växelkurs × (1 + Tullprocent/100) + Proportionell andel av fraktkostnaden`}
              </Typography>
            </Box>
            <Alert severity="info">
              <Typography variant="body2">
                <strong>Viktigt:</strong> Denna beräkning förutsätter att priserna i prislistan är korrekta. Produkter som saknar pris i prislistan kommer att behålla sina nuvarande priser i resultatet.
              </Typography>
            </Alert>
          </Paper>
          
          {/* Tabell med produkter för inleverans */}
          <TableContainer component={Paper} sx={{ maxHeight: '50vh' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>ProductID</TableCell>
                  <TableCell>Artikelnr</TableCell>
                  <TableCell>Artikelnamn</TableCell>
                  <TableCell>Storlek</TableCell>
                  <TableCell align="right">Aktuellt lager</TableCell>
                  <TableCell align="right">Nuvarande pris (SEK)</TableCell>
                  <TableCell align="right">Beställt antal</TableCell>
                  <TableCell align="right">Mottaget antal</TableCell>
                  <TableCell align="right">Nytt pris (SEK)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {receivingOrder?.items?.map((item) => {
                  if (!item.productId) return null;
                  const stockInfo = stockLevels[item.productId] || { stock: 0, unitCost: 0 };
                  const priceKey = `${item.productId}_${item.size}`;
                  const priceInfo = selectedPriceList?.priceMap?.[priceKey];
                  const receivedQty = receivedQuantities[item.productId] || 0;
                  
                  // Kontrollera om denna rad kommer få nytt pris
                  const willUpdatePrice = priceInfo && receivedQty > 0;
                  
                  return (
                    <TableRow 
                      key={item.productId} 
                      hover
                      sx={{
                        // Markera rader som kommer få nya priser med ljusgrön bakgrund
                        backgroundColor: willUpdatePrice ? '#f0fff4' : 'inherit',
                        // Markera rader utan pris i prislistan med ljusröd bakgrund
                        ...(selectedPriceList && !priceInfo && { backgroundColor: '#fff5f5' })
                      }}
                    >
                      <TableCell>{item.productId}</TableCell>
                      <TableCell>{item.productNumber}</TableCell>
                      <TableCell>{item.productName}</TableCell>
                      <TableCell>{item.size}</TableCell>
                      <TableCell align="right">
                        {/* Visa bara lagersaldo om det finns specifikt för denna storlek, annars "-" */}
                        {stockLevels[`${item.productId}_${item.size}`]?.stock !== undefined 
                          ? Math.round(stockLevels[`${item.productId}_${item.size}`].stock) 
                          : "-"}
                      </TableCell>
                      <TableCell align="right">{stockInfo.unitCost.toFixed(2)}</TableCell>
                      <TableCell align="right">{item.quantity}</TableCell>
                      <TableCell align="right">
                        <TextField
                          variant="outlined"
                          size="small"
                          type="number"
                          inputProps={{ 
                            min: 0, 
                            max: item.quantity,
                            style: { textAlign: 'right', padding: '4px 8px' } 
                          }}
                          value={receivedQuantities[item.productId] || 0}
                          onChange={(e) => handleReceivedQuantityChange(item.productId, e.target.value)}
                          sx={{ width: '80px' }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {newUnitCosts[item.productId]?.toFixed(2) || "-"}
                        {willUpdatePrice && newUnitCosts[item.productId] !== stockInfo.unitCost && (
                          <Chip 
                            size="small" 
                            color="success" 
                            variant="outlined" 
                            label="Uppdaterat" 
                            sx={{ fontSize: '0.6rem', ml: 1, height: '18px' }}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          
          {/* Visa sammanfattning av kostnadsberäkning */}
          <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              Kostnadssammanfattning:
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <Typography variant="body2" color="text.secondary">
                  Valuta: {receivingCurrency}
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="body2" color="text.secondary">
                  Växelkurs: {receivingCurrency === "SEK" ? 1 : exchangeRate}
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="body2" color="text.secondary">
                  Tull: {customsDutyPercent}%
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="body2" color="text.secondary">
                  Frakt: {shippingCost} SEK
                </Typography>
              </Grid>
            </Grid>
            
            {/* Ny summering av resultat */}
            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
              Resultat av prisberäkning:
            </Typography>
            <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 2, bgcolor: '#fafafa' }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                    Totalt antal produkter: {receivingOrder?.items?.length || 0}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                    Produkter med priser i prislistan: {
                      receivingOrder?.items?.filter(item => {
                        const priceKey = `${item.productId}_${item.size}`;
                        return selectedPriceList?.priceMap?.[priceKey];
                      }).length || 0
                    }
                  </Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                    Produkter med mottagna kvantiteter: {
                      Object.values(receivedQuantities).filter(qty => qty > 0).length
                    }
                  </Typography>
                </Grid>
              </Grid>
              
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  CSV-filen kommer att innehålla nya priser för produkter där:
                  <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                    <li>Produkten har pris i den valda prislistan</li>
                    <li>Mottagen kvantitet är större än 0</li>
                  </ul>
                  Övriga produkter behåller sina befintliga priser.
                </Typography>
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setReceivingDialogOpen(false)}
            disabled={processingReceiving}
          >
            Avbryt
          </Button>
          {!selectedPriceList ? (
            <Tooltip title="Du måste välja en prislista först">
              <span>
                <Button
                  variant="contained"
                  disabled={true}
                  startIcon={<DownloadIcon />}
                  color="primary"
                >
                  Skapa CSV med nya priser
                </Button>
              </span>
            </Tooltip>
          ) : (
            <Button
              variant="contained"
              onClick={downloadNewUnitCostCSV}
              disabled={processingReceiving}
              startIcon={<DownloadIcon />}
              color="primary"
            >
              Skapa CSV med nya priser
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default HanteraInkopsOrder; 