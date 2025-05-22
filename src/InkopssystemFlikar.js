import React, { useState } from 'react';
import { Box, Tabs, Tab, Typography, Paper } from '@mui/material';
import SkapaInkopsOrder from './SkapaInkopsOrder';
import HanteraInkopsOrder from './HanteraInkopsOrder';
import PriceListManager from './PriceListManager';

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`inkop-tabpanel-${index}`}
      aria-labelledby={`inkop-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function InkopssystemFlikar() {
  const [activeTab, setActiveTab] = useState(0);
  
  const handleChange = (event, newValue) => {
    setActiveTab(newValue);
  };
  
  // Ny funktion för att byta till hantera inköpsorder-fliken
  const switchToHandleOrders = () => {
    setActiveTab(1);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Paper sx={{ mb: 2 }}>
        <Tabs 
          value={activeTab} 
          onChange={handleChange} 
          aria-label="Inköpssystem flikar"
          variant="fullWidth"
        >
          <Tab label="Skapa inköpsorder" />
          <Tab label="Hantera inköpsorder" />
          <Tab label="Hantera prislistor" />
        </Tabs>
      </Paper>
      
      <TabPanel value={activeTab} index={0}>
        <SkapaInkopsOrder onOrderSaved={switchToHandleOrders} />
      </TabPanel>
      
      <TabPanel value={activeTab} index={1}>
        <HanteraInkopsOrder />
      </TabPanel>
      
      <TabPanel value={activeTab} index={2}>
        <PriceListManager />
      </TabPanel>
    </Box>
  );
}

export default InkopssystemFlikar; 