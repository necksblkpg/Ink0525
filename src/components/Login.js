import React, { useState } from 'react';
import { Box, Typography, Button, Paper, Alert } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { useAuth } from '../contexts/AuthContext';

function Login() {
  const { signInWithGoogle, authError } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Inloggningsfel:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        bgcolor: '#f5f5f5',
        p: 2
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: 400,
          width: '100%'
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom>
          Inköpssystem
        </Typography>
        
        <Typography variant="body1" align="center" sx={{ mb: 3 }}>
          Logga in för att få åtkomst till inköpssystemet.
          Endast behörig användare (neckwearsweden@gmail.com) kan logga in.
        </Typography>
        
        {authError && (
          <Alert severity="error" sx={{ mb: 3, width: '100%' }}>
            {authError}
          </Alert>
        )}
        
        <Button
          variant="contained"
          color="primary"
          startIcon={<GoogleIcon />}
          onClick={handleGoogleLogin}
          disabled={loading}
          fullWidth
          size="large"
          sx={{ mt: 2 }}
        >
          {loading ? 'Loggar in...' : 'Logga in med Google'}
        </Button>
      </Paper>
    </Box>
  );
}

export default Login; 