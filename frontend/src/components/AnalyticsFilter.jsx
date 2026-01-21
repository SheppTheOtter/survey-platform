import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, FormControl, Select, MenuItem, InputLabel, IconButton, Tooltip, Chip } from '@mui/material';
import { FilterList as FilterIcon, Close as CloseIcon, ArrowForward as ArrowIcon } from '@mui/icons-material';

export default function AnalyticsFilter({ questions, onApplyFilter, activeFilter }) {
    const [selectedQId, setSelectedQId] = useState('');
    const [selectedOptionIdx, setSelectedOptionIdx] = useState('');

    // Apenas perguntas de múltipla escolha podem ser usadas como filtro (padrão de mercado)
    const validQuestions = questions.filter(q => q.type === 'multiple_choice');
    
    const selectedQuestionObj = validQuestions.find(q => q.id === selectedQId);

    const handleApply = () => {
        if (selectedQId !== '' && selectedOptionIdx !== '') {
            onApplyFilter({ qId: selectedQId, optIdx: selectedOptionIdx, qText: selectedQuestionObj.text });
        }
    };

    const handleClear = () => {
        setSelectedQId('');
        setSelectedOptionIdx('');
        onApplyFilter(null);
    };

    // Se houver um filtro ativo vindo de cima (props), sincroniza o estado local
    useEffect(() => {
        if (!activeFilter) {
            setSelectedQId('');
            setSelectedOptionIdx('');
        }
    }, [activeFilter]);

    if (activeFilter) {
        return (
            <Paper 
                elevation={0} 
                sx={{ 
                    p: 2, mb: 3, bgcolor: '#e3f2fd', border: '1px solid #90caf9',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}
            >
                <Box display="flex" alignItems="center" gap={1}>
                    <FilterIcon color="primary" />
                    <Typography variant="body2" color="primary" fontWeight="bold">
                        Filtrando por:
                    </Typography>
                    <Chip 
                        label={`P${selectedQuestionObj ? selectedQuestionObj.position + 1 : '?'} - ${activeFilter.qText}`} 
                        size="small" color="primary" variant="outlined" 
                    />
                    <ArrowIcon fontSize="small" color="action" />
                    <Chip 
                        // Tenta achar o texto da opção baseada no índice
                        label={selectedQuestionObj?.options.find(o => o.index === activeFilter.optIdx)?.text || "Opção"} 
                        size="small" color="primary" 
                    />
                </Box>
                <Tooltip title="Remover Filtro">
                    <IconButton size="small" onClick={handleClear} color="primary">
                        <CloseIcon />
                    </IconButton>
                </Tooltip>
            </Paper>
        );
    }

    return (
        <Paper elevation={0} sx={{ p: 2, mb: 3, bgcolor: '#f8f9fa', border: '1px solid #e0e0e0' }}>
            <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                <Box display="flex" alignItems="center" gap={1} mr={2}>
                    <FilterIcon color="action" />
                    <Typography variant="subtitle2" color="text.secondary">
                        Filtrar Resultados:
                    </Typography>
                </Box>

                <FormControl size="small" sx={{ minWidth: 250 }}>
                    <InputLabel>Selecionar Pergunta (Segmento)</InputLabel>
                    <Select
                        value={selectedQId}
                        label="Selecionar Pergunta (Segmento)"
                        onChange={(e) => { setSelectedQId(e.target.value); setSelectedOptionIdx(''); }}
                    >
                        {validQuestions.map((q) => (
                            <MenuItem key={q.id} value={q.id}>
                                <strong>P{q.position + 1}.</strong>&nbsp;{q.text.substring(0, 40)}{q.text.length > 40 ? '...' : ''}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 200 }} disabled={!selectedQId}>
                    <InputLabel>Selecionar Resposta</InputLabel>
                    <Select
                        value={selectedOptionIdx}
                        label="Selecionar Resposta"
                        onChange={(e) => setSelectedOptionIdx(e.target.value)}
                    >
                        {selectedQuestionObj?.options.map((opt) => (
                            <MenuItem key={opt.index} value={opt.index}>
                                {opt.text}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <IconButton 
                    color="primary" 
                    disabled={selectedQId === '' || selectedOptionIdx === ''}
                    onClick={handleApply}
                    sx={{ bgcolor: '#e3f2fd', '&:hover': { bgcolor: '#bbdefb' } }}
                >
                    <ArrowIcon />
                </IconButton>
            </Box>
        </Paper>
    );
}