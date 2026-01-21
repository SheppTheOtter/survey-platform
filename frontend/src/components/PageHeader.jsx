import React from 'react';
import { Box, Typography, Divider } from '@mui/material';

export default function PageHeader({ title, subtitle, action }) {
    return (
        <Box sx={{ mb: 3 }}>
            <Box 
                sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    mb: 1 
                }}
            >
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: '#1a2027', letterSpacing: '-0.5px' }}>
                        {title}
                    </Typography>
                    {subtitle && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {subtitle}
                        </Typography>
                    )}
                </Box>
                {/* Área de Ação (Botões) */}
                <Box>
                    {action}
                </Box>
            </Box>
            
            {/* Linha separadora sutil para definir o fim do cabeçalho */}
            <Divider sx={{ borderColor: '#f0f0f0' }} />
        </Box>
    );
}