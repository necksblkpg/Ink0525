import React, { useState, useMemo } from 'react';
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
  Tooltip
} from '@mui/material';

function InkopModul() {
  // Data & laddning
  const [analysisOrders, setAnalysisOrders] = useState([]);
  const [productInfo, setProductInfo] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Datumintervall
  const [startDate, setStartDate] = useState(formatDateForInput(new Date(new Date().setDate(new Date().getDate() - 30))));
  const [endDate, setEndDate] = useState(formatDateForInput(new Date()));

  // Inställningar
  const [deliveryTime, setDeliveryTime] = useState(3); // Leveranstid (dagar)
  const [salesAdjustment, setSalesAdjustment] = useState(100); // Försäljningsjustering (%)
  const [desiredCoverageDays, setDesiredCoverageDays] = useState(30); // Önskad lagertäckning (dagar)

  // Filter för kollektion, leverantör och urgens
  const [selectedCollection, setSelectedCollection] = useState("Alla");
  const [selectedSupplier, setSelectedSupplier] = useState("Alla");
  const [selectedUrgency, setSelectedUrgency] = useState("Alla");

  // Sortering
  const [orderBy, setOrderBy] = useState("urgencyRank");
  const [orderDirection, setOrderDirection] = useState("desc");

  // Hjälpfunktion: Formatera datum (YYYY-MM-DD)
  function formatDateForInput(date) {
    return date.toISOString().split('T')[0];
  }

  // Hämta data via knappen
  const fetchData = () => {
    setLoading(true);
    setError(null);
    const analysisUrl = `https://flask-backend-400816870138.europe-north1.run.app/orderdata/custom-date-range?start_date=${startDate}&end_date=${endDate}`;
    Promise.all([
      fetch(analysisUrl, { mode: 'cors' }).then(res => {
        if (!res.ok) throw new Error('Nätverksfel vid hämtning av orderdata');
        return res.json();
      }),
      fetch('https://flask-backend-400816870138.europe-north1.run.app/product-info', { mode: 'cors' }).then(res => {
        if (!res.ok) throw new Error('Nätverksfel vid hämtning av produktinformation');
        return res.json();
      })
    ])
      .then(([analysisJson, productJson]) => {
        setAnalysisOrders(analysisJson.data);
        setProductInfo(productJson.data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  };

  // Hämta unika värden för filter
  const uniqueCollections = useMemo(() => {
    return Array.from(new Set(productInfo.map(product => product.collection).filter(Boolean))).sort();
  }, [productInfo]);
  const uniqueSuppliers = useMemo(() => {
    return Array.from(new Set(productInfo.map(product => product.supplier).filter(Boolean))).sort();
  }, [productInfo]);

  // Aggregera orderdata – grupperat på product_number (konvertera till versaler)
  const getAggregatedOrderData = () => {
    const aggregatedData = new Map();
    analysisOrders.forEach(order => {
      const key = order.product_number ? order.product_number.toUpperCase() : null;
      if (!key) return;
      if (!aggregatedData.has(key)) {
        aggregatedData.set(key, { totalSales: 0, productName: order.product_name, product_id: order.product_id });
      }
      const data = aggregatedData.get(key);
      if (order.line_typename === "ProductOrderLine" || order.line_typename === "BundleOrderLine") {
        const qty = parseInt(order.quantity || 0);
        data.totalSales += qty;
      }
      if (Array.isArray(order.children)) {
        order.children.forEach(child => {
          const childKey = child.child_product_number ? child.child_product_number.toUpperCase() : null;
          if (!childKey) return;
          if (!aggregatedData.has(childKey)) {
            aggregatedData.set(childKey, { totalSales: 0, productName: child.child_product_name, product_id: child.child_product_id });
          }
          const childData = aggregatedData.get(childKey);
          if (child.child_line_typename === "BundleItemOrderLine") {
            const childQty = parseInt(child.child_quantity || 0);
            childData.totalSales += childQty;
          }
        });
      }
    });
    return aggregatedData;
  };

  // Beräkna antal dagar i valt intervall
  const getPeriodDays = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
  };

  // Beräkna rekommenderad beställningskvantitet
  const calculateReorderQuantity = (totalSales, currentStock) => {
    const periodDays = getPeriodDays();
    const avgDailySales = totalSales / periodDays;
    const adjustedDailySales = avgDailySales * (salesAdjustment / 100);
    const requiredStock = adjustedDailySales * (deliveryTime + desiredCoverageDays);
    const reorderQty = Math.max(0, Math.ceil(requiredStock - (currentStock || 0)));
    return { reorderQty, avgDailySales, adjustedDailySales };
  };

  // Beräkna urgens och "Dagar kvar" med hänsyn till försäljningsjusteringen
  const computeUrgency = (currentStock, avgDailySales) => {
    if (avgDailySales <= 0) return { urgency: "Ingen försäljning", daysLeft: "N/A", urgencyRank: 0 };
    const effectiveDailySales = avgDailySales * (salesAdjustment / 100);
    const daysLeft = currentStock / effectiveDailySales;
    let urgency = "";
    let urgencyRank = 0;
    if (daysLeft < deliveryTime) {
      urgency = "Hög";
      urgencyRank = 3;
    } else if (daysLeft < deliveryTime + desiredCoverageDays / 2) {
      urgency = "Medium";
      urgencyRank = 2;
    } else {
      urgency = "Låg";
      urgencyRank = 1;
    }
    return { urgency, daysLeft, urgencyRank };
  };

  // Skapa orderförslag – iterera över alla produkter, filtrera ut med vald kollektion, leverantör och urgens.
  // Filtrera dessutom bort produkter där isBundle är true.
  // Nu: Filtrera även bort produkter vars status inte är "ACTIVE"
  const suggestions = useMemo(() => {
    const aggregatedData = getAggregatedOrderData();
    let filteredProducts = productInfo.filter(product => {
      // Filtrera bort bundle-produkter
      if (String(product.isBundle).toLowerCase() === "true") return false;
      // Filtrera endast produkter med status "ACTIVE"
      if (product.status !== "ACTIVE") return false;
      const collectionMatch = selectedCollection === "Alla" || product.collection === selectedCollection;
      const supplierMatch = selectedSupplier === "Alla" || product.supplier === selectedSupplier;
      return collectionMatch && supplierMatch;
    });
    const suggestionList = filteredProducts.map(product => {
      const key = product.productNumber ? product.productNumber.toUpperCase() : "";
      const orderData = aggregatedData.get(key) || { totalSales: 0, productName: null, product_id: product.product_id };
      // I kolumn "Produkt" visas orderData.productName om den finns, annars product.productNumber
      const name = orderData.productName ? orderData.productName : product.productNumber;
      const currentStock = product.totalPhysicalQuantity ? parseFloat(product.totalPhysicalQuantity) : 0;
      const { reorderQty, avgDailySales } = calculateReorderQuantity(orderData.totalSales, currentStock);
      const { urgency, daysLeft, urgencyRank } = computeUrgency(currentStock, avgDailySales);
      return {
        productNumber: key,
        productName: name,
        product_id: orderData.product_id, // Inkludera produkt-id
        totalSales: orderData.totalSales,
        currentStock,
        avgDailySales,
        reorderQty,
        urgency,
        daysLeft: typeof daysLeft === "number" ? daysLeft.toFixed(1) : daysLeft,
        urgencyRank
      };
    });
    // Filtrera på urgens om ett annat alternativ än "Alla" är valt
    const filteredByUrgency = selectedUrgency === "Alla" ? suggestionList : suggestionList.filter(item => item.urgency === selectedUrgency);
    // Sortera enligt vald sortering
    filteredByUrgency.sort((a, b) => {
      let aValue = a[orderBy];
      let bValue = b[orderBy];
      if (orderBy === "urgency") {
        aValue = a.urgencyRank;
        bValue = b.urgencyRank;
      }
      if (orderBy === "daysLeft") {
        aValue = aValue === "N/A" ? -Infinity : parseFloat(aValue);
        bValue = bValue === "N/A" ? -Infinity : parseFloat(bValue);
      }
      if (typeof aValue === "number" && typeof bValue === "number") {
        return orderDirection === "asc" ? aValue - bValue : bValue - aValue;
      } else {
        aValue = aValue ? aValue.toString().toLowerCase() : "";
        bValue = bValue ? bValue.toString().toLowerCase() : "";
        if (aValue < bValue) return orderDirection === "asc" ? -1 : 1;
        if (aValue > bValue) return orderDirection === "asc" ? 1 : -1;
        return 0;
      }
    });
    return filteredByUrgency;
  }, [analysisOrders, productInfo, selectedCollection, selectedSupplier, selectedUrgency, deliveryTime, salesAdjustment, desiredCoverageDays, orderBy, orderDirection, startDate, endDate]);

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && orderDirection === "asc";
    setOrderDirection(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  return (
    <Box sx={{ p: 4, width: '100%' }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Inköpsmodul - Orderförslag (Prioritering)
      </Typography>
      
      {/* Filtersektion */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2, width: '100%' }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Filter & Inställningar
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={3}>
            <TextField
              label="Från datum"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              label="Till datum"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            <Tooltip title="Ange leveranstid i dagar">
              <TextField
                label="Leveranstid (dagar)"
                type="number"
                value={deliveryTime}
                onChange={(e) => setDeliveryTime(parseInt(e.target.value) || 0)}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Tooltip>
          </Grid>
          <Grid item xs={12} sm={2}>
            <Tooltip title="Ange justering i procent (t.ex. 110 för 110%)">
              <TextField
                label="Försäljningsjustering (%)"
                type="number"
                value={salesAdjustment}
                onChange={(e) => setSalesAdjustment(parseInt(e.target.value) || 0)}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Tooltip>
          </Grid>
          <Grid item xs={12} sm={2}>
            <Tooltip title="Ange önskad lagertäckning i dagar">
              <TextField
                label="Önskad lagertäckning (dagar)"
                type="number"
                value={desiredCoverageDays}
                onChange={(e) => setDesiredCoverageDays(parseInt(e.target.value) || 0)}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Tooltip>
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth>
              <InputLabel>Kollektion</InputLabel>
              <Select
                label="Kollektion"
                value={selectedCollection}
                onChange={(e) => setSelectedCollection(e.target.value)}
              >
                <MenuItem value="Alla">Alla</MenuItem>
                {uniqueCollections.map((col, idx) => (
                  <MenuItem key={idx} value={col}>{col}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth>
              <InputLabel>Leverantör</InputLabel>
              <Select
                label="Leverantör"
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
              >
                <MenuItem value="Alla">Alla</MenuItem>
                {uniqueSuppliers.map((sup, idx) => (
                  <MenuItem key={idx} value={sup}>{sup}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth>
              <InputLabel>Urgens</InputLabel>
              <Select
                label="Urgens"
                value={selectedUrgency}
                onChange={(e) => setSelectedUrgency(e.target.value)}
              >
                <MenuItem value="Alla">Alla</MenuItem>
                <MenuItem value="Hög">Hög</MenuItem>
                <MenuItem value="Medium">Medium</MenuItem>
                <MenuItem value="Låg">Låg</MenuItem>
                <MenuItem value="Ingen försäljning">Ingen försäljning</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <Button variant="contained" onClick={fetchData}>
              Uppdatera data
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Orderförslagstabel med sticky header, scroll och sortering */}
      {loading ? (
        <Box display="flex" alignItems="center" justifyContent="center" height="60vh">
          <CircularProgress />
        </Box>
      ) : error ? (
        <Box display="flex" alignItems="center" justifyContent="center" height="60vh">
          <Typography variant="h6" color="error">
            Fel: {error}
          </Typography>
        </Box>
      ) : suggestions.length === 0 ? (
        <Typography variant="body1">
          Inget data att visa. Tryck på "Uppdatera data" för att hämta information.
        </Typography>
      ) : (
        <TableContainer component={Paper} sx={{ maxHeight: 800, width: '100%' }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === "productName"}
                    direction={orderBy === "productName" ? orderDirection : "asc"}
                    onClick={() => handleRequestSort("productName")}
                  >
                    Produkt
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === "productNumber"}
                    direction={orderBy === "productNumber" ? orderDirection : "asc"}
                    onClick={() => handleRequestSort("productNumber")}
                  >
                    Artikelnr
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === "product_id"}
                    direction={orderBy === "product_id" ? orderDirection : "asc"}
                    onClick={() => handleRequestSort("product_id")}
                  >
                    Produkt-ID
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={orderBy === "totalSales"}
                    direction={orderBy === "totalSales" ? orderDirection : "asc"}
                    onClick={() => handleRequestSort("totalSales")}
                  >
                    Total försäljning
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={orderBy === "currentStock"}
                    direction={orderBy === "currentStock" ? orderDirection : "asc"}
                    onClick={() => handleRequestSort("currentStock")}
                  >
                    Nuvarande lager
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={orderBy === "avgDailySales"}
                    direction={orderBy === "avgDailySales" ? orderDirection : "asc"}
                    onClick={() => handleRequestSort("avgDailySales")}
                  >
                    Snitt dagsförsäljning
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={orderBy === "reorderQty"}
                    direction={orderBy === "reorderQty" ? orderDirection : "asc"}
                    onClick={() => handleRequestSort("reorderQty")}
                  >
                    Rekommenderad beställning
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === "urgency"}
                    direction={orderBy === "urgency" ? orderDirection : "asc"}
                    onClick={() => handleRequestSort("urgency")}
                  >
                    Urgens
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={orderBy === "daysLeft"}
                    direction={orderBy === "daysLeft" ? orderDirection : "asc"}
                    onClick={() => handleRequestSort("daysLeft")}
                  >
                    {`Dagar kvar (${salesAdjustment}%)`}
                  </TableSortLabel>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {suggestions.map((item) => (
                <TableRow key={item.productNumber}>
                  <TableCell>{item.productName}</TableCell>
                  <TableCell>{item.productNumber}</TableCell>
                  <TableCell>{item.product_id}</TableCell>
                  <TableCell align="right">{item.totalSales}</TableCell>
                  <TableCell align="right">{item.currentStock}</TableCell>
                  <TableCell align="right">{item.avgDailySales.toFixed(2)}</TableCell>
                  <TableCell align="right">{item.reorderQty}</TableCell>
                  <TableCell>{item.urgency}</TableCell>
                  <TableCell align="right">{item.daysLeft}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

export default InkopModul;
