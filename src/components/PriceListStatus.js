import React from 'react';
import { 
  Paper, 
  Typography, 
  Table, 
  TableHead, 
  TableBody, 
  TableRow, 
  TableCell, 
  Box, 
  Chip, 
  Tooltip
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';

function PriceListStatus({ items, priceMap, title = "Prisinformation från vald prislista" }) {
  // Räkna antalet produkter som har priser i prislistan
  const productsWithPrices = items ? items.filter(item => {
    const priceKey = `${item.productId}_${item.size}`;
    return priceMap && priceMap[priceKey];
  }).length : 0;
  
  // Beräkna procentandel av produkter med priser
  const percentage = items && items.length > 0 
    ? Math.round((productsWithPrices / items.length) * 100) 
    : 0;

  return (
    <Paper elevation={0} sx={{ p: 2, bgcolor: '#f5f5f5', mt: 1 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="subtitle2">
          {title}
        </Typography>
        <Tooltip title="Denna tabell visar vilka produkter som har priser i den valda prislistan">
          <InfoIcon color="action" fontSize="small" />
        </Tooltip>
      </Box>
      
      <Box mb={2}>
        <Typography variant="body2" color="text.secondary">
          {productsWithPrices} av {items ? items.length : 0} produkter ({percentage}%) har priser i den valda prislistan.
        </Typography>
      </Box>
      
      <Box sx={{ maxHeight: '150px', overflow: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Produkt ID</TableCell>
              <TableCell>Storlek</TableCell>
              <TableCell align="right">Pris i prislista</TableCell>
              <TableCell>Valuta</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items && items.map((item, index) => {
              const priceKey = `${item.productId}_${item.size}`;
              const priceInfo = priceMap && priceMap[priceKey];
              return (
                <TableRow key={index} sx={{
                  backgroundColor: !priceInfo ? '#fff9f9' : 'inherit'
                }}>
                  <TableCell>{item.productId}</TableCell>
                  <TableCell>{item.size}</TableCell>
                  <TableCell align="right">
                    {priceInfo ? (
                      <Box component="span" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                        {priceInfo.price.toFixed(2)}
                      </Box>
                    ) : (
                      <Box component="span" sx={{ color: 'text.secondary' }}>
                        -
                      </Box>
                    )}
                  </TableCell>
                  <TableCell>
                    {priceInfo ? (
                      <Box component="span" sx={{ color: 'success.main' }}>
                        {priceInfo.currency}
                      </Box>
                    ) : (
                      <Box component="span" sx={{ color: 'text.secondary' }}>
                        -
                      </Box>
                    )}
                  </TableCell>
                  <TableCell>
                    {priceInfo ? (
                      <Chip 
                        size="small" 
                        color="success" 
                        variant="outlined" 
                        label="Pris finns" 
                        sx={{ fontSize: '0.7rem' }}
                      />
                    ) : (
                      <Chip 
                        size="small" 
                        color="error" 
                        variant="outlined" 
                        label="Pris saknas" 
                        sx={{ fontSize: '0.7rem' }}
                      />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
    </Paper>
  );
}

export default PriceListStatus; 