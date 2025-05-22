import React from 'react';
import { AppBar, Toolbar, Typography, Box, Button } from '@mui/material';
import InkopssystemFlikar from './InkopssystemFlikar';
import Login from './components/Login';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LogoutIcon from '@mui/icons-material/Logout';

function AppContent() {
  const { currentUser, signOut } = useAuth();

  if (!currentUser) {
    return <Login />;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Övre menyrad */}
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Inköpssystem
          </Typography>
          <Typography variant="body2" sx={{ mr: 2 }}>
            Inloggad som: {currentUser.email}
          </Typography>
          <Button 
            color="inherit" 
            onClick={signOut}
            startIcon={<LogoutIcon />}
          >
            Logga ut
          </Button>
        </Toolbar>
      </AppBar>

      {/* Huvudinnehåll */}
      <Box sx={{ mt: 4, px: 2 }}>
        <InkopssystemFlikar />
      </Box>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
