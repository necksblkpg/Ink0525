import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography, 
  Paper, 
  CircularProgress,
  Grid,
  Card,
  CardContent,
  CardHeader
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

function BusinessIntelligence() {
  const [analysisOrders, setAnalysisOrders] = useState([]);
  const [productInfo, setProductInfo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [productTypeData, setProductTypeData] = useState([]);
  
  // Färgpalett för diagram
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1'];

  // Hämtar analysdata för de senaste 30 dagarna
  const fetchAnalysisOrders = () => {
    setLoading(true);
    fetch('https://flask-backend-400816870138.europe-north1.run.app/orderdata/last-30-days', { mode: 'cors' })
      .then(res => {
        if (!res.ok) throw new Error('Nätverksfel vid hämtning av analysdata');
        return res.json();
      })
      .then(json => {
        setAnalysisOrders(json.data);
        fetchProductInfo();
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  };

  // Hämtar produktinformation
  const fetchProductInfo = () => {
    fetch('https://flask-backend-400816870138.europe-north1.run.app/product-info', { mode: 'cors' })
      .then(res => {
        if (!res.ok) throw new Error('Nätverksfel vid hämtning av produktinformation');
        return res.json();
      })
      .then(json => {
        setProductInfo(json.data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  };

  // Bearbetar data för visualisering när både analysisOrders och productInfo har laddats
  useEffect(() => {
    if (analysisOrders.length > 0 && productInfo.length > 0) {
      processDataForVisualization();
    }
  }, [analysisOrders, productInfo]);

  // Körs när komponenten laddas
  useEffect(() => {
    fetchAnalysisOrders();
  }, []);

  // Bearbetar data för visualisering
  const processDataForVisualization = () => {
    // Skapa mappning från produktnummer till produktinfo
    const productInfoMap = productInfo.reduce((acc, product) => {
      acc[product.productNumber] = product;
      return acc;
    }, {});

    // Samla försäljning per produkttyp (endast fristående försäljning)
    const productTypeMap = new Map();

    analysisOrders.forEach(order => {
      const productNumber = order.product_number;
      const info = productInfoMap[productNumber];
      const productType = info?.productType || 'Okänd';
      const qty = parseInt(order.quantity || 0);

      if (!productTypeMap.has(productType)) {
        productTypeMap.set(productType, { standalone: 0, name: productType });
      }
      
      const data = productTypeMap.get(productType);
      data.standalone += qty;
    });

    // Konvertera Map till array för visualisering och filtrera bort typer med 0 försäljning
    const result = Array.from(productTypeMap.values())
      .filter(item => item.standalone > 0)
      .sort((a, b) => b.standalone - a.standalone);
    
    setProductTypeData(result);
  };

  // Beräknar totalt antal fristående sålda produkter
  const getTotalSold = () => {
    return productTypeData.reduce((sum, item) => sum + item.standalone, 0);
  };

  // Formaterar etiketter för PieChart
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null;
    
    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
      >
        {`${name} (${(percent * 100).toFixed(0)}%)`}
      </text>
    );
  };

  if (loading) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" height="80vh">
        <CircularProgress />
      </Box>
    );
  }

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
      <Typography variant="h5" gutterBottom>
        Business Intelligence - Försäljning per produkttyp (senaste 30 dagarna)
      </Typography>
      <Typography variant="subtitle1" gutterBottom sx={{ mb: 4 }}>
        Visualisering baserad på fristående försäljningar, totalt {getTotalSold()} produkter
      </Typography>

      <Grid container spacing={4}>
        {/* Stapeldiagram */}
        <Grid item xs={12} md={7}>
          <Card>
            <CardHeader title="Försäljning per produkttyp" />
            <CardContent sx={{ height: 400 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={productTypeData}
                  margin={{ top: 20, right: 30, left: 40, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45} 
                    textAnchor="end" 
                    height={80} 
                    interval={0}
                  />
                  <YAxis />
                  <Tooltip formatter={(value) => [`${value} st`, 'Fristående']} />
                  <Legend />
                  <Bar 
                    dataKey="standalone" 
                    name="Antal sålda"
                    fill="#0088FE" 
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Cirkeldiagram */}
        <Grid item xs={12} md={5}>
          <Card>
            <CardHeader title="Fördelning av försäljning" />
            <CardContent sx={{ height: 400 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={productTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomizedLabel}
                    outerRadius={130}
                    fill="#8884d8"
                    dataKey="standalone"
                  >
                    {productTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} st`, 'Antal sålda']} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Datatabell */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Detaljer per produkttyp
            </Typography>
            <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Produkttyp</th>
                    <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid #ddd' }}>Antal sålda</th>
                    <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid #ddd' }}>Andel av försäljning</th>
                  </tr>
                </thead>
                <tbody>
                  {productTypeData.map((item, index) => (
                    <tr key={index}>
                      <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{item.name}</td>
                      <td style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid #eee' }}>{item.standalone}</td>
                      <td style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid #eee' }}>
                        {((item.standalone / getTotalSold()) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default BusinessIntelligence; 