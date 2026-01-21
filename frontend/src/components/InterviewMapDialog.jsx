import React from 'react';
import { Dialog, DialogTitle, DialogContent, Grid, Button, Typography, Box } from '@mui/material';

export default function InterviewMapDialog({ open, onClose, data, onNavigate }) {
    if (!data) return null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Mapa de Entrevistas</DialogTitle>
            <DialogContent>
                <Box mb={2} display="flex" gap={2}>
                    <Box display="flex" alignItems="center" gap={1}><Box width={12} height={12} borderRadius="50%" bgcolor="#4caf50" /> Completa</Box>
                    <Box display="flex" alignItems="center" gap={1}><Box width={12} height={12} borderRadius="50%" bgcolor="#f44336" /> Incompleta</Box>
                </Box>
                
                <Grid container spacing={1}>
                    {data.map((item) => (
                        <Grid item key={item.number}>
                            <Button
                                variant="contained"
                                onClick={() => { onNavigate(item.number); onClose(); }}
                                sx={{
                                    minWidth: 45,
                                    width: 45,
                                    height: 45,
                                    borderRadius: '50%',
                                    bgcolor: item.is_complete ? '#4caf50' : '#f44336',
                                    color: 'white',
                                    fontWeight: 'bold',
                                    '&:hover': {
                                        bgcolor: item.is_complete ? '#388e3c' : '#d32f2f'
                                    }
                                }}
                            >
                                {item.number}
                            </Button>
                        </Grid>
                    ))}
                </Grid>
                
                {data.length === 0 && <Typography>Nenhuma entrevista iniciada.</Typography>}
            </DialogContent>
        </Dialog>
    );
}