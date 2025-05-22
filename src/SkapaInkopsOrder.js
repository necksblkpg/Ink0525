import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Grid,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Checkbox,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Tooltip,
  Alert,
  InputAdornment,
  LinearProgress
} from '@mui/material';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import DownloadIcon from '@mui/icons-material/Download';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  getDocs, 
  query, 
  where, 
  onSnapshot 
} from 'firebase/firestore';

function SkapaInkopsOrder({ onOrderSaved }) {
  // Data & laddning
  const [analysisOrders, setAnalysisOrders] = useState([]);
  const [productInfo, setProductInfo] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState([]);

  // Ny state för inkommande kvantiteter och redigerbara beställningskvantiteter
  const [incomingQuantities, setIncomingQuantities] = useState({});
  const [editableQuantities, setEditableQuantities] = useState({});
  const [loadingIncoming, setLoadingIncoming] = useState(false);

  // Datumintervall - ändra initialiseringen för att använda första dagen i månaden och gårdagens datum
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Istället för att förvara förra datumintervallet
  const [startDate, setStartDate] = useState(formatDateForInput(firstDayOfMonth));
  const [endDate, setEndDate] = useState(formatDateForInput(yesterday));

  // Inställningar
  const [deliveryTime, setDeliveryTime] = useState(10); // Ändra startvärde till 10
  const [safetyStock, setSafetyStock] = useState(30); // Defaultvärde som kommer ersättas av datumintervallsberäkning
  const [growthPercentage, setGrowthPercentage] = useState(0); // Ny state för tillväxtprocent

  // Filter för leverantör och kollektion
  const [selectedSupplier, setSelectedSupplier] = useState("Tessitura Italien");
  const [selectedCollection, setSelectedCollection] = useState("Other");

  // Sortering
  const [orderBy, setOrderBy] = useState("avgDailySales");
  const [orderDirection, setOrderDirection] = useState("desc");

  // Ny state för orderdialogrutan
  const [orderDialog, setOrderDialog] = useState(false);
  const [orderName, setOrderName] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [savingOrder, setSavingOrder] = useState(false);

  // Ny state för att hantera förhandsvisning - ändra så att alla produkter visas
  const [previewMode, setPreviewMode] = useState(false); // Ändra från true till false
  const [previewLimit, setPreviewLimit] = useState(10000); // Ändra från 10 till ett högt värde
  const [dataFetched, setDataFetched] = useState(false);

  // Ny state för att hålla reda på om endast filterdata laddas
  const [loadingFilterData, setLoadingFilterData] = useState(true);
  const [filterDataFetched, setFilterDataFetched] = useState(false);

  // Ändra denna useEffect för att rensa data och sätta standarddatum
  useEffect(() => {
    // Rensa localStorage för att säkerställa att vi inte använder gammal data
    localStorage.removeItem('inkogsorderData');
    
    // Återställ alla tillstånd till standardvärden
    setAnalysisOrders([]);
    setProductInfo([]);
    setSelectedProducts([]);
    setIncomingQuantities({});
    setEditableQuantities({});
    setDataFetched(false);

    // Sätt standarddatum (första dagen i nuvarande månad och gårdagens datum)
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    setStartDate(formatDateForInput(firstDayOfMonth));
    setEndDate(formatDateForInput(yesterday));
    
    // Hämta bara filterdata som behövs för dropdowns
    fetchProductInfoForFilters();
  }, []); // Kör endast vid mount

  // Ladda sparad data när komponenten monteras
  // useEffect(() => {
  //   // Kolla om vi har sparad data
  //   const savedData = localStorage.getItem('inkogsorderData');
  //   if (savedData) {
  //     try {
  //       const data = JSON.parse(savedData);
  //       
  //       // Återställ alla tillstånd från sparad data
  //       if (data.analysisOrders) setAnalysisOrders(data.analysisOrders);
  //       if (data.productInfo) setProductInfo(data.productInfo);
  //       if (data.startDate) setStartDate(data.startDate);
  //       if (data.endDate) setEndDate(data.endDate);
  //       if (data.selectedSupplier) setSelectedSupplier(data.selectedSupplier);
  //       if (data.selectedCollection) setSelectedCollection(data.selectedCollection);
  //       if (data.deliveryTime) setDeliveryTime(data.deliveryTime);
  //       if (data.safetyStock) setSafetyStock(data.safetyStock);
  //       if (data.growthPercentage) setGrowthPercentage(data.growthPercentage);
  //       if (data.selectedProducts) setSelectedProducts(data.selectedProducts);
  //       if (data.editableQuantities) setEditableQuantities(data.editableQuantities);
  //       if (data.incomingQuantities) setIncomingQuantities(data.incomingQuantities);
  //       
  //       // Ange att data är hämtad
  //       if (data.dataFetched) {
  //         setDataFetched(true);
  //         setFilterDataFetched(true);
  //         setPreviewMode(false);
  //       }
  //     } catch (error) {
  //       console.error("Fel vid inläsning av sparad data:", error);
  //     }
  //   }
  // }, []); // Kör endast vid mount

  // Sparar tillståndet till localStorage när viktiga data ändras
  useEffect(() => {
    // Spara endast om det finns analysdata eller filterdata 
    if ((analysisOrders?.length > 0 || productInfo?.length > 0) && dataFetched) {
      saveDataToLocalStorage();
    }
  }, [
    analysisOrders, 
    productInfo, 
    startDate, 
    endDate, 
    selectedSupplier, 
    selectedCollection, 
    deliveryTime, 
    safetyStock, 
    growthPercentage, 
    selectedProducts, 
    editableQuantities, 
    incomingQuantities,
    dataFetched
  ]);

  // Lägg till en effekt som automatiskt beräknar safetyStock baserat på datumintervall
  useEffect(() => {
    // Beräkna antalet dagar i valt intervall
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const periodDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    
    // Uppdatera safetyStock baserat på periodDays
    setSafetyStock(periodDays);
  }, [startDate, endDate]); // Körs när start- eller slutdatum ändras

  // Hjälpfunktion: Formatera datum (YYYY-MM-DD)
  function formatDateForInput(date) {
    return date.toISOString().split('T')[0];
  }

  // Hämta endast produktinformation för filter när komponenten laddas
  const fetchProductInfoForFilters = () => {
    setLoadingFilterData(true);
    setError(null);
    
    fetch('https://flask-backend-400816870138.europe-north1.run.app/product-info', { mode: 'cors' })
      .then(res => {
        if (!res.ok) throw new Error('Nätverksfel vid hämtning av produktinformation');
        return res.json();
      })
      .then(productJson => {
        // Logga för att inspektera datan
        console.log("Produktinfo från API:", productJson);
        
        // Kontrollera om supplier och collection finns i datan
        if (productJson.data && productJson.data.length > 0) {
          const firstProduct = productJson.data[0];
          console.log("Första produkten:", firstProduct);
          console.log("Supplier finns:", 'supplier' in firstProduct);
          console.log("Collection finns:", 'collection' in firstProduct);
          
          // Undersök alla olika attributnamn i första produkten
          console.log("Attribut i första produkten:", Object.keys(firstProduct));
        }
        
        setProductInfo(productJson.data);
        setLoadingFilterData(false);
        setFilterDataFetched(true);
      })
      .catch(err => {
        console.error("Fel vid hämtning av produktinformation:", err);
        setError(err.message);
        setLoadingFilterData(false);
      });
  };

  // Kör filterdata-hämtning när komponenten laddas
  useEffect(() => {
    fetchProductInfoForFilters();
  }, []);

  // Modifierad effekt som återställer editableQuantities när filter ändras
  useEffect(() => {
    // Återställ editableQuantities när användaren ändrar filter, vilket tvingar nya beräkningar
    setEditableQuantities({});
  }, [selectedSupplier, selectedCollection, deliveryTime, safetyStock, growthPercentage]);

  // Hämta data - ändra så att förhandsvisningen inte aktiveras
  const fetchData = () => {
    setLoading(true);
    setError(null);
    setPreviewMode(false);
    setDataFetched(false);
    
    // Använd den nya endpointen som inkluderar storlekar
    const analysisUrl = `https://flask-backend-400816870138.europe-north1.run.app/orderdata/custom-date-range-with-sizes?start_date=${startDate}&end_date=${endDate}`;
    
    Promise.all([
      fetch(analysisUrl, { mode: 'cors' }).then(res => {
        if (!res.ok) throw new Error('Nätverksfel vid hämtning av orderdata');
        return res.json();
      }),
      // Om vi redan har produktinfon, behöver vi inte hämta den igen
      filterDataFetched ? Promise.resolve({ data: productInfo }) :
      fetch('https://flask-backend-400816870138.europe-north1.run.app/product-info', { mode: 'cors' }).then(res => {
        if (!res.ok) throw new Error('Nätverksfel vid hämtning av produktinformation');
        return res.json();
      })
    ])
      .then(([analysisJson, productJson]) => {
        setAnalysisOrders(analysisJson.data);
        // Bara uppdatera produktinfon om vi faktiskt hämtade den
        if (!filterDataFetched) {
          setProductInfo(productJson.data);
        }
        setLoading(false);
        setDataFetched(true);
        
        // Spara data till localStorage
        saveDataToLocalStorage();
        
        // Hämta inkommande kvantiteter efter att vi har hämtat produktdata
        fetchIncomingQuantities();
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  };

  // Modifierad funktion som lyssnar på inkommande kvantiteter i realtid
  useEffect(() => {
    // Bara starta lyssnaren om vi har hämtat data
    if (!dataFetched) return;
    
    setLoadingIncoming(true);
    console.log("Startar real-time lyssnare för inkommande kvantiteter...");
    
    // Skapa en query för purchaseOrders-samlingen
    const q = query(collection(db, "purchaseOrders"));
    
    // Skapa en real-time lyssnare
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      // Temporär lagringsstruktur för inkommande kvantiteter
      const incoming = {};
      
      // Gå igenom alla ordrar och summera inkommande kvantiteter per produkt och storlek
      querySnapshot.forEach(doc => {
        const orderData = doc.data();
        
        // Kontrollera att items finns och är en array
        if (Array.isArray(orderData.items)) {
          orderData.items.forEach(item => {
            // Kontrollera om vi har både productId och size
            if (!item.productId || !item.size) {
              // Fallback till gamla strukturen om product_id används istället
              if (item.product_id) {
                // Extrahera original productId och size från kombinerad product_id
                // Om product_id är i formatet "originalId_size"
                const parts = item.product_id.split('_');
                if (parts.length >= 2) {
                  const originalId = parts[0];
                  const size = parts.slice(1).join('_'); // Om storleken själv innehåller understreck
                  
                  // Skapa en korrekt nyckel baserad på original-ID och storlek
                  const key = `${originalId}_${size}`;
                  incoming[key] = (incoming[key] || 0) + item.quantity;
                } else {
                  // Om vi bara har product_id utan storleksinformation
                  console.warn("Order item utan storleksinformation:", item);
                }
              }
              return;
            }
            
            // Normalisera storleken (ta bort onödiga mellanslag, etc)
            const normalizedSize = item.size.trim();
            
            // Skapa en nyckel baserad på produkt-ID och normaliserad storlek
            const key = `${item.productId}_${normalizedSize}`;
            
            // Addera kvantiteten till den befintliga summan eller skapa en ny post
            incoming[key] = (incoming[key] || 0) + item.quantity;
          });
        }
      });
      
      // Uppdatera state med de nya inkommande kvantiteterna
      setIncomingQuantities(incoming);
      setLoadingIncoming(false);
      console.log("Inkommande kvantiteter uppdaterade i realtid:", incoming);
      
      // Spara data till localStorage för att behålla dem när komponenten avmonteras
      saveDataToLocalStorage();
    }, (error) => {
      console.error("Fel vid lyssning på inkommande kvantiteter:", error);
      setLoadingIncoming(false);
    });
    
    // Rensa lyssnaren när komponenten avmonteras eller när dataFetched ändras
    return () => {
      console.log("Stoppar real-time lyssnare för inkommande kvantiteter");
      unsubscribe();
    };
  }, [dataFetched]); // Endast köra denna effekt när dataFetched ändras
  
  // Håll kvar den ursprungliga fetchIncomingQuantities som en fallback eller för initialisering
  const fetchIncomingQuantities = async () => {
    // Vi behöver inte implementera denna funktion längre eftersom vi använder real-time lyssnaren istället
    console.log("fetchIncomingQuantities anropad, men vi använder nu real-time lyssnare istället");
  };

  // Hämta unika värden för filter
  const uniqueSuppliers = useMemo(() => {
    console.log("Antal produkter för leverantörsfilter:", productInfo.length);
    
    // Logga alla leverantörsvärden innan filtrering för att se vad som finns
    const allSupplierValues = productInfo.map(product => {
      console.log(`Produkt ${product.productId || 'unknown'} leverantör:`, product.supplier);
      return product.supplier;
    });
    console.log("Alla leverantörsvärden:", allSupplierValues);
    
    return ["Alla", ...Array.from(new Set(productInfo.map(product => product.supplier).filter(Boolean))).sort()];
  }, [productInfo]);

  const uniqueCollections = useMemo(() => {
    return ["Alla", ...Array.from(new Set(productInfo.map(product => product.collection).filter(Boolean))).sort()];
  }, [productInfo]);

  // Aggregera orderdata – grupperat på product_number
  const getAggregatedOrderData = () => {
    const aggregatedData = new Map();
    
    // Först samlar vi ihop all försäljningsdata
    analysisOrders.forEach(order => {
      const key = order.product_number ? order.product_number.toUpperCase() : null;
      if (!key) return;
      
      const size = order.size || "One Size";
      const sizeKey = `${key}_${size}`;
      
      if (!aggregatedData.has(sizeKey)) {
        aggregatedData.set(sizeKey, { 
          totalSales: 0, 
          productName: order.product_name, 
          product_id: order.product_id,
          size: size
        });
      }
      
      const data = aggregatedData.get(sizeKey);
      if (order.line_typename === "ProductOrderLine" || order.line_typename === "BundleOrderLine") {
        const qty = parseInt(order.quantity || 0);
        data.totalSales += qty;
      }
    });
    
    return aggregatedData;
  };

  // Beräkna antal dagar i valt intervall - används direkt för safetyStock
  const getPeriodDays = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
  };

  // Beräkna rekommenderad beställningskvantitet - uppdatera för att inkludera inkommande kvantiteter
  const calculateReorderQuantity = (totalSales, currentStock, incomingQty = 0) => {
    const periodDays = getPeriodDays();
    const avgDailySales = totalSales / periodDays;

    // Applicera tillväxtprocent på genomsnittlig daglig försäljning
    const adjustedAvgDailySales = avgDailySales * (1 + growthPercentage / 100);

    // Hur mycket lager förväntas finnas kvar när ordern anländer?
    const remainingStockAtDelivery = currentStock - adjustedAvgDailySales * deliveryTime;

    // Lagerbehov när ordern anländer baserat på hela leveranstiden och säkerhetslager
    const requiredStock = adjustedAvgDailySales * (deliveryTime + safetyStock);

    // Dra bara av lager som finns kvar samt inkommande kvantiteter
    const reorderQty = Math.max(
      0,
      Math.ceil(requiredStock - Math.max(remainingStockAtDelivery, 0) - (incomingQty || 0))
    );

    return { reorderQty, avgDailySales };
  };

  // Hjälpfunktion för att tolka storleksinformation och extrahera både storlek och eventuellt lagersaldo
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

  // Sammanställ data för visualisering
  const suggestions = useMemo(() => {
    const salesData = getAggregatedOrderData();
    const results = [];

    // Koppla ihop produktinfo med försäljningsdata
    productInfo.forEach(product => {
      if (!product.productNumber) return;
      
      // Filtrera bort produkter som inte är aktiva eller som är bundles
      if (product.status !== "ACTIVE") return;
      if (product.isBundle === true) return;
      
      const key = product.productNumber.toUpperCase();
      const salesInfo = salesData.get(key) || { totalSales: 0, productName: product.productName || "-" };
      
      // Filtrera baserat på vald leverantör och kollektion
      if (selectedSupplier !== "Alla" && product.supplier !== selectedSupplier) return;
      if (selectedCollection !== "Alla" && product.collection !== selectedCollection) return;
      
      // Tolka storleksinformation
      const sizeData = parseSizeInfo(product.productSizeInfo);
      const totalStock = parseFloat(product.totalPhysicalQuantity || 0);
      
      // Beräkna reorderQty baserat på försäljningsdata
      const { reorderQty, avgDailySales } = calculateReorderQuantity(
        salesInfo.totalSales,
        totalStock,
        0 // Eftersom detta bara är en preliminär beräkning utan specifik storlek, sätter vi inkommande till 0
      );
      
      // Om det finns flera storlekar, fördela lika mellan dem
      const qtyPerSize = Math.ceil(reorderQty / sizeData.length);
      
      // Skapa en rad för varje storlek
      sizeData.forEach(sizeItem => {
        // Normalisera storleken för konsekvent matchning
        const normalizedSize = sizeItem.size.trim();
        
        // Hämta försäljningsdata specifikt för denna storlek
        const productNumberKey = product.productNumber ? product.productNumber.toUpperCase() : "";
        const sizeKey = `${productNumberKey}_${normalizedSize}`;
        const salesInfo = salesData.get(sizeKey) || { totalSales: 0, productName: null };
        
        // Använd antingen det extraherade lagersaldot från storlekssträngen, 
        // eller fördela totallagret jämnt över alla storlekar
        const sizeStock = sizeItem.stock > 0 ? 
          sizeItem.stock : 
          Math.round(totalStock / sizeData.length);
        
        // Beräkna genomsnittlig daglig försäljning och rekommenderad beställningskvantitet
        // baserat på försäljning för denna specifika storlek, inkludera inkommande kvantiteter
        const { reorderQty: sizeReorderQty, avgDailySales: sizeAvgDailySales } = calculateReorderQuantity(
          salesInfo.totalSales, 
          sizeStock,
          incomingQuantities[`${product.product_id}_${normalizedSize}`] || 0
        );
        
        // Skapa produkt-ID och storlek som nyckel för inkommande kvantiteter
        const incomingKey = `${product.product_id}_${normalizedSize}`;
        
        // Hämta inkommande kvantitet för denna produkt+storlek
        const incoming = incomingQuantities[incomingKey] || 0;
        
        // Skapa unik produkt-ID för denna kombination av produkt och storlek
        const productId = `${product.product_id}_${normalizedSize}`;
        
        // Lägg till produkten i resultatlistan
        results.push({
          product_id: productId, // Unik ID för produkt+storlek
          productId: product.product_id, // Original produkt-ID
          productName: salesInfo.productName || product.productNumber,
          productNumber: product.productNumber,
          supplier: product.supplier || "-",
          currentStock: sizeStock,
          size: normalizedSize, // Använd den normaliserade storleken
          unitCost: product.unitCost || 0,
          collection: product.collection || "-",
          totalSales: salesInfo.totalSales || 0,
          avgDailySales: sizeAvgDailySales || 0,
          incomingQty: incoming,
          reorderQty: sizeReorderQty // Använd den beräknade kvantiteten för denna storlek
        });
        
        // Skapa en initial redigerbar kvantitet om den inte redan finns
        if (editableQuantities[productId] === undefined) {
          setEditableQuantities(prev => ({
            ...prev,
            [productId]: sizeReorderQty
          }));
        }
      });
    });

    // Sortera resultaten
    return results.sort((a, b) => {
      if (orderDirection === "asc") {
        return a[orderBy] - b[orderBy];
      } else {
        return b[orderBy] - a[orderBy];
      }
    });
  }, [productInfo, analysisOrders, selectedSupplier, selectedCollection, deliveryTime, safetyStock, orderBy, orderDirection, incomingQuantities, growthPercentage]);

  // Hantera sortering
  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && orderDirection === "asc";
    setOrderDirection(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  // Hantera checkboxarna för produktval
  const handleProductSelect = (productRowId) => {
    setSelectedProducts(prev => {
      if (prev.includes(productRowId)) {
        return prev.filter(id => id !== productRowId);
      } else {
        return [...prev, productRowId];
      }
    });
  };

  // Hantera ändringar i beställningskvantitet
  const handleQuantityChange = (productId, value) => {
    // Validera värdet (måste vara ett positivt heltal eller tomt)
    const newValue = value === "" ? 0 : Math.max(0, parseInt(value) || 0);
    
    setEditableQuantities(prev => ({
      ...prev,
      [productId]: newValue
    }));
  };

  // Generera CSV från valda produkter
  const generateCSV = (items) => {
    const headers = [
      "ProductID", "Product Number", "Product Name", "Supplier", 
      "Collection", "Stock", "Size", "Unit Cost", "Quantity to Order"
    ];

    const rows = items.map(item => {
      // Använd den redigerbara kvantiteten för Quantity to Order
      const orderQty = editableQuantities[item.product_id] || item.reorderQty;
      
      return [
        item.productId, // Använd original produkt-ID
        item.productNumber,
        item.productName,
        item.supplier,
        item.collection,
        item.currentStock,
        item.size,
        item.unitCost,
        orderQty
      ];
    });

    // Sammanfoga till CSV
    return [headers, ...rows]
      .map(row => row.map(cell => {
        // Kapsla in celler med kommatecken i citattecken
        if (cell && cell.toString().includes(',')) {
          return `"${cell}"`;
        }
        return cell;
      }).join(','))
      .join('\n');
  };

  // Ladda ner CSV som fil
  const downloadCSV = () => {
    const selectedItems = suggestions.filter(item => selectedProducts.includes(item.product_id));
    if (selectedItems.length === 0) return;

    const csv = generateCSV(selectedItems);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.setAttribute('href', url);
    link.setAttribute('download', `purchase_order_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtrera förslag för förhandsvisning
  const displaySuggestions = useMemo(() => {
    if (previewMode && suggestions.length > previewLimit) {
      return suggestions.slice(0, previewLimit);
    }
    return suggestions;
  }, [suggestions, previewMode, previewLimit]);

  // Öppna dialogrutan för att spara ordern
  const openSaveDialog = () => {
    const date = new Date().toLocaleDateString('sv-SE').replace(/\//g, '-');
    setOrderName(`Inköpsorder ${selectedSupplier !== 'Alla' ? selectedSupplier : 'Blandad'} ${date}`);
    setOrderNote("");
    setOrderDialog(true);
  };

  // Spara ordern i Firestore
  const saveOrderToFirestore = async () => {
    if (selectedProducts.length === 0) {
      alert("Välj minst en produkt att beställa.");
      return;
    }

    if (!orderName.trim()) {
      alert("Ange ett namn för inköpsordern.");
      return;
    }

    try {
      setSavingOrder(true);

      // Skapa en array av valda produkter
      const selectedItems = suggestions
        .filter(item => selectedProducts.includes(item.product_id))
        .map(item => ({
          product_id: item.product_id,
          productId: item.productId, // Säkerställ att originalprodukt-ID sparas
          productName: item.productName,
          productNumber: item.productNumber,
          supplier: item.supplier,
          size: item.size,
          unitCost: item.unitCost,
          quantity: editableQuantities[item.product_id] !== undefined 
            ? parseInt(editableQuantities[item.product_id], 10) 
            : item.reorderQty
        }));

      // Beräkna totalsumma
      const totalCost = selectedItems.reduce((sum, item) => sum + (item.unitCost * item.quantity), 0);

      // Generera CSV för nedladdning senare
      const csvData = generateCSV(selectedItems);

      // Spara order till Firestore
      await addDoc(collection(db, "purchaseOrders"), {
        name: orderName,
        note: orderNote,
        supplier: selectedSupplier,
        collection: selectedCollection,
        createdAt: serverTimestamp(),
        items: selectedItems,
        totalItems: selectedItems.length,
        totalQuantity: selectedItems.reduce((sum, item) => sum + item.quantity, 0),
        totalCost: totalCost,
        csvData: csvData
      });

      // Återställ formulär
      setOrderDialog(false);
      setOrderName("");
      setOrderNote("");
      setSelectedProducts([]);
      setEditableQuantities({});
      setSavingOrder(false);

      // Visa bekräftelse
      alert("Inköpsordern har sparats!");

      // Uppdatera inkommande kvantiteter
      fetchIncomingQuantities();

      // Dirigera användaren till hantera inköpsorder-fliken om callback finns
      if (onOrderSaved && typeof onOrderSaved === 'function') {
        onOrderSaved();
      }
    } catch (error) {
      console.error("Fel vid sparande av inköpsorder:", error);
      alert(`Fel vid sparande av inköpsorder: ${error.message}`);
      setSavingOrder(false);
    }
  };

  // Modifiera setters för att återställa editableQuantities
  const handleDeliveryTimeChange = (value) => {
    setDeliveryTime(value);
    // Ingen anledning att explicit återställa editableQuantities här
    // eftersom useEffect-hooken nu kommer göra det
  };

  const handleSafetyStockChange = (value) => {
    // Endast för bakåtkompatibilitet - safetyStock beräknas nu automatiskt
    console.log("handleSafetyStockChange anropad, men värdet ignoreras eftersom lagerhållningstid nu beräknas automatiskt");
    // setSafetyStock(value);
  };

  // Lägg till en ny funktion för att spara data
  const saveDataToLocalStorage = () => {
    try {
      const dataToSave = {
        analysisOrders,
        productInfo,
        startDate,
        endDate,
        selectedSupplier,
        selectedCollection,
        deliveryTime,
        safetyStock,
        growthPercentage,
        selectedProducts,
        editableQuantities,
        incomingQuantities,
        dataFetched: true
      };
      
      localStorage.setItem('inkogsorderData', JSON.stringify(dataToSave));
    } catch (error) {
      console.error("Fel vid sparande av data till localStorage:", error);
    }
  };

  // Lägg till en reset-knapp i gränssnittet om du vill kunna rensa sparad data
  const resetAllData = () => {
    // Rensa localStorage
    localStorage.removeItem('inkogsorderData');
    
    // Återställ alla states till deras ursprungliga värden
    setAnalysisOrders([]);
    setProductInfo([]);
    setSelectedProducts([]);
    setIncomingQuantities({});
    setEditableQuantities({});
    setDataFetched(false);
    // osv för resten av tillstånden...
  };

  // Hantera ändringar i leverantörsfilter
  const handleSupplierChange = (value) => {
    setSelectedSupplier(value);
    // Ingen anledning att explicit återställa editableQuantities här 
    // eftersom useEffect-hooken ovan kommer göra det
  };

  // Hantera ändringar i kollektionsfilter
  const handleCollectionChange = (value) => {
    setSelectedCollection(value);
    // Ingen anledning att explicit återställa editableQuantities här
    // eftersom useEffect-hooken ovan kommer göra det
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Skapa Inköpsorder
      </Typography>
      
      {/* Filterpanel */}
      <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              label="Från Datum"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              label="Till Datum"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth>
              <InputLabel>Leveranstid (dagar)</InputLabel>
              <Select
                value={deliveryTime}
                label="Leveranstid (dagar)"
                onChange={(e) => handleDeliveryTimeChange(e.target.value)}
              >
                {[10, 25, 50, 75, 100, 150, 200].map(days => (
                  <MenuItem key={days} value={days}>{days}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              label={`Lagerhållningstid (${safetyStock} dagar)`}
              disabled
              value={safetyStock}
              InputProps={{
                readOnly: true,
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              label="Tillväxt (%)"
              type="number"
              value={growthPercentage}
              onChange={(e) => {
                setGrowthPercentage(parseFloat(e.target.value) || 0);
                // Ingen anledning att explicit återställa editableQuantities här
                // eftersom useEffect-hooken nu kommer göra det
              }}
              InputProps={{
                endAdornment: <InputAdornment position="end">%</InputAdornment>,
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth disabled={loadingFilterData}>
              <InputLabel>Leverantör</InputLabel>
              <Select
                value={selectedSupplier}
                label="Leverantör"
                onChange={(e) => handleSupplierChange(e.target.value)}
                endAdornment={loadingFilterData && <CircularProgress size={20} sx={{ mr: 2 }} />}
              >
                {uniqueSuppliers.map(supplier => (
                  <MenuItem key={supplier} value={supplier}>
                    {supplier}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth disabled={loadingFilterData}>
              <InputLabel>Kollektion</InputLabel>
              <Select
                value={selectedCollection}
                label="Kollektion"
                onChange={(e) => handleCollectionChange(e.target.value)}
                endAdornment={loadingFilterData && <CircularProgress size={20} sx={{ mr: 2 }} />}
              >
                {uniqueCollections.map(collection => (
                  <MenuItem key={collection} value={collection}>
                    {collection}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <Button 
              variant="contained" 
              onClick={fetchData} 
              sx={{ mr: 2 }}
              disabled={loadingFilterData}
            >
              Visa produkter
            </Button>
            <Button 
              variant="outlined" 
              color="primary" 
              disabled={selectedProducts.length === 0}
              onClick={downloadCSV}
              startIcon={<DownloadIcon />}
              sx={{ mr: 2 }}
            >
              Ladda ner valda produkter ({selectedProducts.length})
            </Button>
            <Button 
              variant="outlined" 
              color="success" 
              disabled={selectedProducts.length === 0}
              onClick={openSaveDialog}
              startIcon={<SaveIcon />}
            >
              Skapa valda som inköpsorder ({selectedProducts.length})
            </Button>
            <Button 
              color="error" 
              variant="outlined" 
              onClick={resetAllData}
              startIcon={<RefreshIcon />}
              sx={{ ml: 2 }}
            >
              Rensa data
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Ny info-panel som visas medan filterdata laddas */}
      {loadingFilterData && !error && (
        <Paper sx={{ p: 2, mb: 3, bgcolor: '#f5f5f5' }}>
          <Box display="flex" alignItems="center">
            <CircularProgress size={24} sx={{ mr: 2 }} />
            <Typography variant="body1">
              Laddar leverantörer och kollektioner för filtrering...
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Förhandsvisningsmeddelande */}
      {dataFetched && previewMode && suggestions.length > previewLimit && (
        <Paper sx={{ p: 2, mb: 3, bgcolor: '#e3f2fd' }}>
          <Typography variant="subtitle1" fontWeight="bold">
            Produktöversikt
          </Typography>
          <Typography variant="body2">
            Visar alla {suggestions.length} produkter.
          </Typography>
        </Paper>
      )}

      {/* Produkttabell */}
      {loading || loadingIncoming ? (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ width: '100%' }}>
            <Typography variant="h6" gutterBottom>
              {loading ? "Hämtar produktdata..." : "Hämtar inkommande kvantiteter..."}
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Box sx={{ width: '100%', mr: 1 }}>
                <LinearProgress 
                  variant="indeterminate" 
                  color={loading ? "primary" : "secondary"}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
              <Box sx={{ minWidth: 35 }}>
                <CircularProgress 
                  size={24} 
                  color={loading ? "primary" : "secondary"} 
                />
              </Box>
            </Box>
            
            <Typography variant="body2" color="text.secondary">
              {loading 
                ? "Hämtar och analyserar produktdata från databasen. Detta kan ta en liten stund beroende på datamängden."
                : "Hämtar information om inkommande leveranser från tidigare inköpsordrar."
              }
            </Typography>
          </Box>
        </Paper>
      ) : error ? (
        <Typography variant="body1" color="error">
          {error}
        </Typography>
      ) : !dataFetched ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" gutterBottom>
            Klicka på "Visa produkter" för att visa produktdata och skapa inköpsförslag.
          </Typography>
        </Paper>
      ) : displaySuggestions.length === 0 ? (
        <Typography variant="body1">
          Inga produkter matchade dina filterkriterier.
        </Typography>
      ) : (
        <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox 
                    indeterminate={selectedProducts.length > 0 && selectedProducts.length < suggestions.length}
                    checked={selectedProducts.length === suggestions.length}
                    onChange={() => {
                      if (selectedProducts.length === suggestions.length) {
                        setSelectedProducts([]);
                      } else {
                        setSelectedProducts(suggestions.map(s => s.product_id));
                      }
                    }}
                  />
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === "productId"}
                    direction={orderBy === "productId" ? orderDirection : "asc"}
                    onClick={() => handleRequestSort("productId")}
                  >
                    ProductID
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === "productNumber"}
                    direction={orderBy === "productNumber" ? orderDirection : "asc"}
                    onClick={() => handleRequestSort("productNumber")}
                  >
                    Product Number
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === "productName"}
                    direction={orderBy === "productName" ? orderDirection : "asc"}
                    onClick={() => handleRequestSort("productName")}
                  >
                    Product Name
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === "size"}
                    direction={orderBy === "size" ? orderDirection : "asc"}
                    onClick={() => handleRequestSort("size")}
                  >
                    Size
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === "supplier"}
                    direction={orderBy === "supplier" ? orderDirection : "asc"}
                    onClick={() => handleRequestSort("supplier")}
                  >
                    Supplier
                  </TableSortLabel>
                </TableCell>
                <TableCell>Collection</TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={orderBy === "unitCost"}
                    direction={orderBy === "unitCost" ? orderDirection : "asc"}
                    onClick={() => handleRequestSort("unitCost")}
                  >
                    Unit Cost
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={orderBy === "currentStock"}
                    direction={orderBy === "currentStock" ? orderDirection : "asc"}
                    onClick={() => handleRequestSort("currentStock")}
                  >
                    Stock Balance
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={orderBy === "incomingQty"}
                    direction={orderBy === "incomingQty" ? orderDirection : "asc"}
                    onClick={() => handleRequestSort("incomingQty")}
                  >
                    Incoming Qty
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={orderBy === "totalSales"}
                    direction={orderBy === "totalSales" ? orderDirection : "asc"}
                    onClick={() => handleRequestSort("totalSales")}
                  >
                    Quantity Sold
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={orderBy === "avgDailySales"}
                    direction={orderBy === "avgDailySales" ? orderDirection : "asc"}
                    onClick={() => handleRequestSort("avgDailySales")}
                  >
                    Avg Daily Sales
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Klicka för att redigera värden">
                    <TableSortLabel
                      active={orderBy === "reorderQty"}
                      direction={orderBy === "reorderQty" ? orderDirection : "asc"}
                      onClick={() => handleRequestSort("reorderQty")}
                    >
                      Quantity to Order {growthPercentage > 0 ? `(+${growthPercentage}%)` : ''}
                    </TableSortLabel>
                  </Tooltip>
                </TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displaySuggestions.map((item) => (
                <TableRow key={item.product_id} hover>
                  <TableCell padding="checkbox">
                    <Checkbox 
                      checked={selectedProducts.includes(item.product_id)}
                      onChange={() => handleProductSelect(item.product_id)}
                    />
                  </TableCell>
                  <TableCell>{item.productId}</TableCell>
                  <TableCell>{item.productNumber}</TableCell>
                  <TableCell>{item.productName}</TableCell>
                  <TableCell><strong>{item.size}</strong></TableCell>
                  <TableCell>{item.supplier}</TableCell>
                  <TableCell>{item.collection}</TableCell>
                  <TableCell align="right">{item.unitCost.toFixed(2)}</TableCell>
                  <TableCell align="right">{Math.round(item.currentStock)}</TableCell>
                  <TableCell align="right">{item.incomingQty}</TableCell>
                  <TableCell align="right">{item.totalSales}</TableCell>
                  <TableCell align="right">{item.avgDailySales.toFixed(2)}</TableCell>
                  <TableCell align="right">
                    <TextField
                      variant="outlined"
                      size="small"
                      type="number"
                      inputProps={{ 
                        min: 0, 
                        style: { textAlign: 'right', padding: '4px 8px' } 
                      }}
                      value={editableQuantities[item.product_id] !== undefined ? editableQuantities[item.product_id] : item.reorderQty}
                      onChange={(e) => handleQuantityChange(item.product_id, e.target.value)}
                      sx={{ width: '80px' }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton 
                      color="primary" 
                      size="small"
                      onClick={() => handleProductSelect(item.product_id)}
                    >
                      <AddShoppingCartIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Dialog för att spara inköpsorder */}
      <Dialog open={orderDialog} onClose={() => !savingOrder && setOrderDialog(false)}>
        <DialogTitle>Spara inköpsorder</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Fyll i information om inköpsordern nedan.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="Ordernamn"
            type="text"
            fullWidth
            variant="outlined"
            value={orderName}
            onChange={(e) => setOrderName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Noteringar"
            multiline
            rows={4}
            fullWidth
            variant="outlined"
            value={orderNote}
            onChange={(e) => setOrderNote(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setOrderDialog(false)} 
            disabled={savingOrder}
          >
            Avbryt
          </Button>
          <Button 
            onClick={saveOrderToFirestore} 
            variant="contained" 
            color="primary"
            disabled={!orderName.trim() || savingOrder}
          >
            {savingOrder ? <CircularProgress size={24} /> : "Spara"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// Lägg till defaultProps för att hantera fall där callback inte skickas
SkapaInkopsOrder.defaultProps = {
  onOrderSaved: () => {}
};

export default SkapaInkopsOrder; 