import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Box, Paper, Typography, FormControl, Select, MenuItem, InputLabel,
    Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Button, Alert
} from '@mui/material';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { SwapHoriz } from '@mui/icons-material';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe', '#00C49F', '#FFBB28'];

export default function CrosstabView({ questionnaireId, questions }) {
    // Filtra apenas multipla escolha
    const validQuestions = questions.filter(q => q.type === 'multiple_choice');

    const [rowQ, setRowQ] = useState('');
    const [colQ, setColQ] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    // Carrega dados quando ambos forem selecionados
    useEffect(() => {
        if (rowQ && colQ && questionnaireId) {
            fetchCrosstab();
        }
    }, [rowQ, colQ]);

    const fetchCrosstab = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`http://localhost:8000/analytics/${questionnaireId}/crosstab`, {
                params: { row_question_id: rowQ, col_question_id: colQ }
            });
            setData(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSwap = () => {
        const oldRow = rowQ;
        setRowQ(colQ);
        setColQ(oldRow);
    };

    if (validQuestions.length < 2) {
        return <Alert severity="warning">É necessário ter pelo menos duas perguntas de múltipla escolha para realizar o cruzamento.</Alert>;
    }

    return (
        <Box>
            {/* --- SELETORES --- */}
            <Paper elevation={0} sx={{ p: 2, mb: 3, bgcolor: '#f8f9fa', border: '1px solid #e0e0e0' }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={5}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Linhas (Eixo X)</InputLabel>
                            <Select value={rowQ} label="Linhas (Eixo X)" onChange={e => setRowQ(e.target.value)}>
                                {validQuestions.map(q => (
                                    <MenuItem key={q.id} value={q.id}>P{q.position + 1}. {q.text}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    
                    <Grid item xs={12} md={1} sx={{ textAlign: 'center' }}>
                        <Button onClick={handleSwap} disabled={!rowQ || !colQ}>
                            <SwapHoriz />
                        </Button>
                    </Grid>

                    <Grid item xs={12} md={5}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Colunas (Legenda/Empilhamento)</InputLabel>
                            <Select value={colQ} label="Colunas (Legenda/Empilhamento)" onChange={e => setColQ(e.target.value)}>
                                {validQuestions.map(q => (
                                    <MenuItem key={q.id} value={q.id} disabled={q.id === rowQ}>P{q.position + 1}. {q.text}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                </Grid>
            </Paper>

            {/* --- RESULTADOS --- */}
            {data && (
                <Grid container spacing={4}>
                    {/* GRÁFICO */}
                    <Grid item xs={12}>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                            <Typography variant="h6" gutterBottom align="center">
                                Cruzamento Visual
                            </Typography>
                            <ResponsiveContainer width="100%" height={400}>
                                <BarChart data={data.data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis label={{ value: 'Quantidade', angle: -90, position: 'insideLeft' }} />
                                    <Tooltip />
                                    <Legend />
                                    {data.columns.map((colName, index) => (
                                        <Bar 
                                            key={colName} 
                                            dataKey={colName} 
                                            stackId="a" 
                                            fill={COLORS[index % COLORS.length]} 
                                        />
                                    ))}
                                </BarChart>
                            </ResponsiveContainer>
                        </Paper>
                    </Grid>

                    {/* TABELA */}
                    <Grid item xs={12}>
                        <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                                        <TableCell><strong>{data.row_question}</strong> (Linhas) \ <strong>{data.col_question}</strong> (Colunas)</TableCell>
                                        {data.columns.map((col, i) => (
                                            <TableCell key={i} align="right"><strong>{col}</strong></TableCell>
                                        ))}
                                        <TableCell align="right" sx={{ bgcolor: '#eee' }}><strong>Total</strong></TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {data.data.map((row, idx) => {
                                        // Calcula total da linha
                                        const rowTotal = data.columns.reduce((acc, col) => acc + (row[col] || 0), 0);
                                        return (
                                            <TableRow key={idx} hover>
                                                <TableCell component="th" scope="row"><strong>{row.name}</strong></TableCell>
                                                {data.columns.map((col, i) => (
                                                    <TableCell key={i} align="right">{row[col] || 0}</TableCell>
                                                ))}
                                                <TableCell align="right" sx={{ bgcolor: '#fafafa', fontWeight: 'bold' }}>{rowTotal}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {/* Linha de Total das Colunas */}
                                    <TableRow sx={{ bgcolor: '#eee' }}>
                                        <TableCell><strong>Total Geral</strong></TableCell>
                                        {data.columns.map((col, i) => {
                                            const colTotal = data.data.reduce((acc, r) => acc + (r[col] || 0), 0);
                                            return <TableCell key={i} align="right"><strong>{colTotal}</strong></TableCell>;
                                        })}
                                        <TableCell align="right">
                                            {/* Soma de tudo */}
                                            {data.data.reduce((acc, r) => acc + data.columns.reduce((cAcc, c) => cAcc + (r[c] || 0), 0), 0)}
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Grid>
                </Grid>
            )}

            {!data && (
                <Box textAlign="center" py={5} color="text.secondary">
                    <Typography>Selecione duas perguntas acima para gerar o cruzamento.</Typography>
                </Box>
            )}
        </Box>
    );
}