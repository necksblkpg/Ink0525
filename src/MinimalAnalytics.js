import React, { useEffect, useState } from 'react';
import {
  Box,
  Grid,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  TextField
} from '@mui/material';

function MinimalAnalytics() {
  const [analysisOrders, setAnalysisOrders] = useState([]);
  const [productInfo, setProductInfo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter- och sorteringsstater
  const [productTypeFilter, setProductTypeFilter] = useState('all');
  const [collectionFilter, setCollectionFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [sortBy, setSortBy] = useState('total');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Datumväljare
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const [startDate, setStartDate] = useState(formatDateForInput(thirtyDaysAgo));
  const [endDate, setEndDate] = useState(formatDateForInput(today));

  // Unika filtervärden hämtade från produktinfo
  const [uniqueProductTypes, setUniqueProductTypes] = useState([]);
  const [uniqueCollections, setUniqueCollections] = useState([]);
  const [uniqueSuppliers, setUniqueSuppliers] = useState([]);

  // Formatera datum (YYYY-MM-DD)
  function formatDateForInput(date) {
    return date.toISOString().split('T')[0];
  }

  // Hämtar orderdata för valt datumintervall
  const fetchAnalysisOrders = () => {
    setLoading(true);
    const analysisUrl = `https://flask-backend-400816870138.europe-north1.run.app/orderdata/custom-date-range?start_date=${startDate}&end_date=${endDate}`;
    fetch(analysisUrl, { mode: 'cors' })
      .then(res => {
         if (!res.ok) throw new Error('Nätverksfel vid hämtning av analysdata');
         return res.json();
      })
      .then(json => {
         setAnalysisOrders(json.data);
         setLoading(false);
      })
      .catch(err => {
         setError(err.message);
         setLoading(false);
      });
  };

  // Hämtar produktinformation och extraherar filtervärden
  const fetchProductInfo = () => {
    fetch('https://flask-backend-400816870138.europe-north1.run.app/product-info', { mode: 'cors' })
      .then(res => {
         if (!res.ok) throw new Error('Nätverksfel vid hämtning av produktinformation');
         return res.json();
      })
      .then(json => {
         setProductInfo(json.data);

         const productTypes = new Set();
         const collections = new Set();
         const suppliers = new Set();

         json.data.forEach(product => {
           if (product.productType) productTypes.add(product.productType);
           if (product.collection) collections.add(product.collection);
           if (product.supplier) suppliers.add(product.supplier);
         });

         setUniqueProductTypes(Array.from(productTypes).sort());
         setUniqueCollections(Array.from(collections).sort());
         setUniqueSuppliers(Array.from(suppliers).sort());
      })
      .catch(err => {
         console.error(err);
      });
  };

  // Körs vid komponentens laddning
  useEffect(() => {
    fetchAnalysisOrders();
    fetchProductInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Uppdaterar analysdata manuellt
  const refreshAnalysisData = () => {
    setIsRefreshing(true);
    fetchAnalysisOrders();
    setIsRefreshing(false);
  };

  // Skapa en mappning från productNumber till produktinfo
  const productInfoMap = productInfo.reduce((acc, product) => {
    acc[product.productNumber] = product;
    return acc;
  }, {});

  // Aggregera orderdata – grupperat på product_number
  const getFilteredProductData = () => {
    const productData = analysisOrders.reduce((acc, order) => {
      const key = order.product_number; // Gruppera på product_number
      const productName = order.product_name;
      
      if (key) {
        if (!acc.has(key)) {
          // Spara även produktnamnet från föräldern
          acc.set(key, { standalone: 0, total: 0, productNumber: key, productName });
        }
        const data = acc.get(key);
        // Lägg till försäljning för både vanliga produktorder och bundleorder
        if (order.line_typename === "ProductOrderLine" || order.line_typename === "BundleOrderLine") {
          const qty = parseInt(order.quantity || 0);
          data.standalone += qty;
          data.total += qty;
        }
      }
      
      // Lägg till barnrader (BundleItemOrderLine) till totalen
      if (Array.isArray(order.children)) {
        order.children.forEach(child => {
          const childKey = child.child_product_number;
          const childProductName = child.child_product_name;
          if (childKey) {
            if (!acc.has(childKey)) {
              acc.set(childKey, { standalone: 0, total: 0, productNumber: childKey, productName: childProductName });
            }
            const childData = acc.get(childKey);
            if (child.child_line_typename === "BundleItemOrderLine") {
              const childQty = parseInt(child.child_quantity || 0);
              childData.total += childQty;
            }
          }
        });
      }
      
      return acc;
    }, new Map());
    
    // Filtrera på de valda kriterierna från produktinfo
    return new Map(
      Array.from(productData.entries()).filter(([key, data]) => {
        const info = productInfoMap[data.productNumber] || {};
        if (productTypeFilter !== 'all' && info.productType !== productTypeFilter) return false;
        if (collectionFilter !== 'all' && info.collection !== collectionFilter) return false;
        if (supplierFilter !== 'all' && info.supplier !== supplierFilter) return false;
        return true;
      })
    );
  };

  // Sorterar aggregerad data enligt valt kriterium
  const getSortedProductData = () => {
    const filteredData = getFilteredProductData();
    return Array.from(filteredData.entries()).sort((a, b) => {
      const [, dataA] = a;
      const [, dataB] = b;
      const infoA = productInfoMap[dataA.productNumber] || {};
      const infoB = productInfoMap[dataB.productNumber] || {};
      
      switch (sortBy) {
        case 'total':
          return dataB.total - dataA.total;
        case 'standalone':
          return dataB.standalone - dataA.standalone;
        case 'stock': {
          const stockA = parseFloat(infoA.totalPhysicalQuantity || 0);
          const stockB = parseFloat(infoB.totalPhysicalQuantity || 0);
          return stockB - stockA;
        }
        default:
          return dataB.total - dataA.total;
      }
    });
  };

  // Formatera datum för visning (DD/MM/YYYY)
  const formatDisplayDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('sv-SE');
  };

  // Visa laddningsindikator
  if (loading) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" height="80vh">
        <CircularProgress />
      </Box>
    );
  }

  // Visa felmeddelande om något gick snett
  if (error) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" height="80vh">
        <Typography color="error" variant="h6">
          Fel: {error}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Produktanalys ({formatDisplayDate(startDate)} - {formatDisplayDate(endDate)})
      </Typography>

      {/* Filtersektion */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={2}>
          <TextField
            label="Från datum"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <TextField
            label="Till datum"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={1.6}>
          <FormControl fullWidth>
            <InputLabel>Produkttyp</InputLabel>
            <Select
              label="Produkttyp"
              value={productTypeFilter}
              onChange={(e) => setProductTypeFilter(e.target.value)}
            >
              <MenuItem value="all">Alla produkttyper</MenuItem>
              {uniqueProductTypes.map(type => (
                <MenuItem key={type} value={type}>{type}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} md={1.6}>
          <FormControl fullWidth>
            <InputLabel>Kollektion</InputLabel>
            <Select
              label="Kollektion"
              value={collectionFilter}
              onChange={(e) => setCollectionFilter(e.target.value)}
            >
              <MenuItem value="all">Alla kollektioner</MenuItem>
              {uniqueCollections.map(collection => (
                <MenuItem key={collection} value={collection}>{collection}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} md={1.6}>
          <FormControl fullWidth>
            <InputLabel>Leverantör</InputLabel>
            <Select
              label="Leverantör"
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
            >
              <MenuItem value="all">Alla leverantörer</MenuItem>
              {uniqueSuppliers.map(supplier => (
                <MenuItem key={supplier} value={supplier}>{supplier}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} md={1.6}>
          <FormControl fullWidth>
            <InputLabel>Sortera</InputLabel>
            <Select
              label="Sortera"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <MenuItem value="total">Totalt antal sålda</MenuItem>
              <MenuItem value="standalone">Fristående antal</MenuItem>
              <MenuItem value="stock">Lagersaldo</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} md={1.6}>
          <Button
            variant="contained"
            onClick={refreshAnalysisData}
            disabled={isRefreshing}
            fullWidth
            sx={{ height: '56px' }}
          >
            {isRefreshing ? 'Uppdaterar...' : 'Uppdatera data'}
          </Button>
        </Grid>
      </Grid>

      {/* Tabell */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Produkt</TableCell>
              <TableCell>Artikelnr</TableCell>
              <TableCell>Produkttyp</TableCell>
              <TableCell>Kollektion</TableCell>
              <TableCell>Leverantör</TableCell>
              <TableCell>Lagersaldo</TableCell>
              <TableCell>Storlekar</TableCell>
              <TableCell>Fristående</TableCell>
              <TableCell>Totalt</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {getSortedProductData().map(([key, data]) => {
              const info = productInfoMap[data.productNumber] || {};
              const displayName = data.productName || (info.productNumber || key);
              return (
                <TableRow key={data.productNumber}>
                  <TableCell sx={{ fontWeight: 500 }}>{displayName}</TableCell>
                  <TableCell>{data.productNumber}</TableCell>
                  <TableCell>{info.productType || '-'}</TableCell>
                  <TableCell>{info.collection || '-'}</TableCell>
                  <TableCell>{info.supplier || '-'}</TableCell>
                  <TableCell>{info.totalPhysicalQuantity || '-'}</TableCell>
                  <TableCell>{info.productSizeInfo || '-'}</TableCell>
                  <TableCell>{data.standalone}</TableCell>
                  <TableCell>{data.total}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default MinimalAnalytics;
