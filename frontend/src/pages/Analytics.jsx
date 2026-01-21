import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import {
    Box, Paper, Typography, Grid, Select, MenuItem, FormControl, InputLabel,
    Card, CardContent, Divider, Chip, Table, TableBody, TableCell, TableHead,
    TableRow, Button, Stack, ToggleButton, ToggleButtonGroup, Tooltip,
    Menu, ListItemIcon, ListItemText
} from '@mui/material';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LabelList
} from 'recharts';
import { 
    SaveAlt as ExportIcon, 
    Print as PrintIcon,
    BarChart as BarChartIcon,
    PieChart as PieChartIcon,
    Home as HomeIcon,
    MoreVert as MoreIcon,
    TableChart as CsvIcon,
    Description as DocIcon,
    Backup as BackupIcon,
    Restore as RestoreIcon,
    UploadFile as UploadIcon,
    ViewList as ViewListIcon,
    PivotTableChart as PivotIcon
} from '@mui/icons-material';
import { saveAs } from 'file-saver';
import QuestionnaireSelector from '../components/QuestionnaireSelector';
import PageHeader from '../components/PageHeader';
import AnalyticsFilter from '../components/AnalyticsFilter';
import CrosstabView from '../components/CrosstabView'; 

const API = 'https://survey-platform-sc3c.onrender.com';
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ff6b6b', '#4ecdc4'];

const QuestionAnalysisCard = ({ question }) => {
    const [chartType, setChartType] = useState('bar_v');
    const [sortMode, setSortMode] = useState('original');
    const [labelMode, setLabelMode] = useState('both'); 
    const [openMode, setOpenMode] = useState('grouped_norm');
    
    let data = [];
    if (question.type === 'multiple_choice') data = question.stats;
    else if (question.type === 'open') {
        if (openMode === 'grouped_norm') data = question.stats.normalized;
        else if (openMode === 'grouped_exact') data = question.stats.exact;
    }

    const sortedData = React.useMemo(() => {
        if (!data) return [];
        const clone = [...data];
        if (sortMode === 'asc') return clone.sort((a, b) => a.value - b.value);
        if (sortMode === 'desc') return clone.sort((a, b) => b.value - a.value);
        return clone.sort((a, b) => a.original_index - b.original_index);
    }, [data, sortMode]);
    
    const renderCustomLabel = (props) => {
        const { x, y, width, value, index } = props;
        const dataItem = sortedData[index];
        const percentVal = dataItem ? dataItem.calculated_percent : 0;
        if (props.cx) { 
             const RADIAN = Math.PI / 180;
             const radius = props.innerRadius + (props.outerRadius - props.innerRadius) * 0.5;
             const cx = props.cx + radius * Math.cos(-props.midAngle * RADIAN);
             const cy = props.cy + radius * Math.sin(-props.midAngle * RADIAN);
             let text = "";
             if (labelMode === 'value' || labelMode === 'both') text += `${value}`;
             if (labelMode === 'both') text += `\n`;
             if (labelMode === 'percent' || labelMode === 'both') text += `${(props.percent * 100).toFixed(1)}%`;
             return <text x={cx} y={cy} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12}>{text}</text>;
        }
        let text = "";
        if (labelMode === 'value' || labelMode === 'both') text += `${value}`;
        if (labelMode === 'both') text += ` (`;
        if (labelMode === 'percent' || labelMode === 'both') text += `${percentVal}%`;
        if (labelMode === 'both') text += `)`;
        return <text x={x + width / 2} y={y - 5} fill="#666" textAnchor="middle" fontSize={12}>{text}</text>;
    };

    const renderChart = () => {
         if (data.length === 0) return <Typography align="center" mt={5}>Sem dados</Typography>;
         return (
             <ResponsiveContainer width="100%" height={300}>
                 {chartType === 'pie' ? (
                     <PieChart>
                         <Pie data={sortedData} cx="50%" cy="50%" labelLine={false} label={renderCustomLabel} outerRadius={100} fill="#8884d8" dataKey="value">
                             {sortedData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                         </Pie>
                         <RechartsTooltip formatter={(value, name, props) => [`${value} (${props.payload.calculated_percent}%)`, name]} />
                         <Legend />
                     </PieChart>
                 ) : (
                     <BarChart layout={chartType === 'bar_h' ? 'vertical' : 'horizontal'} data={sortedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                         <CartesianGrid strokeDasharray="3 3" />
                         {chartType === 'bar_h' ? <><XAxis type="number" /><YAxis dataKey="name" type="category" width={100} /></> : <><XAxis dataKey="name" /><YAxis /></>}
                         <RechartsTooltip cursor={{fill: 'transparent'}} formatter={(value, name, props) => [`${value} (${props.payload.calculated_percent}%)`, "Qtd."]} />
                         <Bar dataKey="value" name="Qtd." fill="#8884d8" barSize={chartType === 'bar_h' ? 20 : 40}>
                            {sortedData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            <LabelList dataKey="value" content={renderCustomLabel} />
                         </Bar>
                     </BarChart>
                 )}
             </ResponsiveContainer>
         );
    };

    return (
        <Card variant="outlined" sx={{ mb: 4, breakInside: 'avoid' }}>
            <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                    <Box>
                         <Typography variant="h6"><strong>P{question.position + 1}.</strong> {question.text}</Typography>
                         <Typography variant="caption" color="text.secondary">Respondidas: {question.total_answers}</Typography>
                    </Box>
                    <Chip size="small" label={question.type === 'multiple_choice' ? 'Múltipla Escolha' : 'Aberta'} />
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, py: 2, mb: 2, bgcolor: '#f8f9fa', px: 1, borderRadius: 1, '@media print': { display: 'none' } }}>
                    {question.type === 'open' && (
                        <FormControl size="small" sx={{ minWidth: 150 }}>
                            <InputLabel>Visualização</InputLabel>
                            <Select value={openMode} label="Visualização" onChange={e => setOpenMode(e.target.value)}>
                                <MenuItem value="grouped_norm">Agrupado (Smart)</MenuItem>
                                <MenuItem value="grouped_exact">Agrupado (Exato)</MenuItem>
                                <MenuItem value="raw">Lista Bruta</MenuItem>
                            </Select>
                        </FormControl>
                    )}
                    {(question.type === 'multiple_choice' || openMode !== 'raw') && (
                        <>
                            <ToggleButtonGroup size="small" value={chartType} exclusive onChange={(e, v) => v && setChartType(v)}>
                                <ToggleButton value="bar_v"><Tooltip title="Barras Verticais"><BarChartIcon sx={{transform: 'rotate(90deg)'}} /></Tooltip></ToggleButton>
                                <ToggleButton value="bar_h"><Tooltip title="Barras Horizontais"><BarChartIcon /></Tooltip></ToggleButton>
                                <ToggleButton value="pie"><Tooltip title="Pizza"><PieChartIcon /></Tooltip></ToggleButton>
                            </ToggleButtonGroup>
                            <FormControl size="small" sx={{ minWidth: 120 }}>
                                <InputLabel>Ordem</InputLabel>
                                <Select value={sortMode} label="Ordem" onChange={e => setSortMode(e.target.value)}>
                                    <MenuItem value="original">Original</MenuItem>
                                    <MenuItem value="desc">Maior Valor</MenuItem>
                                    <MenuItem value="asc">Menor Valor</MenuItem>
                                </Select>
                            </FormControl>
                            <FormControl size="small" sx={{ minWidth: 120 }}>
                                <InputLabel>Rótulos</InputLabel>
                                <Select value={labelMode} label="Rótulos" onChange={e => setLabelMode(e.target.value)}>
                                    <MenuItem value="value">Qtd.</MenuItem>
                                    <MenuItem value="percent">%</MenuItem>
                                    <MenuItem value="both">Ambos</MenuItem>
                                </Select>
                            </FormControl>
                        </>
                    )}
                </Box>
                <Grid container spacing={4}>
                    {(question.type === 'multiple_choice' || openMode !== 'raw') && (
                        <Grid item xs={12} md={7} sx={{ minHeight: 300 }}>{renderChart()}</Grid>
                    )}
                    <Grid item xs={12} md={(question.type === 'multiple_choice' || openMode !== 'raw') ? 5 : 12}>
                        {openMode === 'raw' ? (
                            <Box sx={{ maxHeight: 400, overflow: 'auto', bgcolor: '#fafafa', p: 2, borderRadius: 1 }}>
                                {question.raw_answers.map((ans, idx) => <Typography key={idx} variant="body2" sx={{ borderBottom: '1px solid #eee', py: 0.5 }}>{idx + 1}. {ans}</Typography>)}
                            </Box>
                        ) : (
                            <Table size="small">
                                <TableHead><TableRow sx={{ bgcolor: '#f5f5f5' }}><TableCell>Opção/Resposta</TableCell><TableCell align="right">Qtd.</TableCell><TableCell align="right">%</TableCell></TableRow></TableHead>
                                <TableBody>
                                    {sortedData.map((row, idx) => (
                                    <TableRow key={idx}>
                                            <TableCell><Box display="flex" alignItems="center" gap={1}><Box width={10} height={10} bgcolor={COLORS[idx % COLORS.length]} borderRadius="50%" />{row.name}</Box></TableCell>
                                            <TableCell align="right">{row.value}</TableCell>
                                            <TableCell align="right"><strong>{row.calculated_percent}%</strong></TableCell>
                                    </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </Grid>
                </Grid>
            </CardContent>
        </Card>
    );
};

export default function Analytics() {
    const [view, setView] = useState('grid');
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [analysisMode, setAnalysisMode] = useState('report'); 
    const [activeFilter, setActiveFilter] = useState(null);
    const [anchorEl, setAnchorEl] = useState(null);
    const openMenu = Boolean(anchorEl);
    const fileInputRef = useRef(null);

    const loadReport = async (qId, filter = null) => {
        setLoading(true);
        try {
            let url = `${API}/analytics/${qId}/report`;
            if (filter) {
                url += `?filter_question_id=${filter.qId}&filter_option_index=${filter.optIdx}`;
            }
            const res = await axios.get(url);
            setReportData(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectQuestionnaire = async (q) => {
        setActiveFilter(null);
        setAnalysisMode('report'); 
        await loadReport(q.id);
        setView('report');
    };

    const handleFilterChange = (filter) => {
        setActiveFilter(filter);
        if (reportData && reportData.questionnaire) {
            loadReport(reportData.questionnaire.id, filter);
        }
    };

    const handleMenuClick = (event) => setAnchorEl(event.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);

    // --- FUNÇÕES DE EXPORTAÇÃO ---
    const handlePrint = () => { 
        window.print(); 
        handleMenuClose(); 
    };

    const handleExportDoc = () => {
        if (!reportData) return;
        // PADRONIZAÇÃO: Nome atualizado para "Total de Entrevistas"
        let htmlContent = `<html><head><meta charset='utf-8'><title>Relatório</title></head><body><h1>Relatório: ${reportData.questionnaire.name}</h1><p><strong>Total de Entrevistas:</strong> ${reportData.total_interviews}</p><hr/>`;
        reportData.questions.forEach((q) => {
            htmlContent += `<h3>P${q.position + 1}. ${q.text}</h3><p>Total: ${q.total_answers}</p>`;
            const renderTable = (data) => {
                let table = `<table border="1" width="100%"><tr><th>Opção</th><th>Qtd.</th><th>%</th></tr>`;
                data.forEach(i => table += `<tr><td>${i.name}</td><td>${i.value}</td><td>${i.calculated_percent}%</td></tr>`);
                return table + `</table>`;
            }
            if (q.type === 'multiple_choice') htmlContent += renderTable(q.stats);
            else { 
                if (q.stats.normalized) htmlContent += `<h4>Agrupamento</h4>` + renderTable(q.stats.normalized); 
                htmlContent += `<h4>Bruto</h4><ul>`; 
                q.raw_answers.forEach(a => htmlContent += `<li>${a}</li>`); 
                htmlContent += `</ul>`; 
            }
        });
        htmlContent += `</body></html>`;
        saveAs(new Blob(['\ufeff', htmlContent], { type: 'application/msword' }), `Relatorio.doc`);
        handleMenuClose();
    };

    const handleExportCsvData = async () => {
        if (!reportData) return;
        try {
            const response = await axios.get(`${API}/analytics/${reportData.questionnaire.id}/export/data_csv`, { responseType: 'blob' });
            saveAs(response.data, `${reportData.questionnaire.name}_dados.csv`);
        } catch (e) { console.error("Erro exportar CSV", e); }
        handleMenuClose();
    };

    const handleExportBackup = async () => {
        if (!reportData) return;
        try {
            const response = await axios.get(`${API}/analytics/${reportData.questionnaire.id}/export/backup_json`, { responseType: 'blob' });
            saveAs(response.data, `${reportData.questionnaire.name}_backup.json`);
        } catch (e) { console.error("Erro backup", e); }
        handleMenuClose();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append("file", file);
        setLoading(true);
        try {
            await axios.post(`${API}/analytics/import/backup_json`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert("Backup restaurado com sucesso!");
            setView('grid'); 
            window.location.reload(); 
        } catch (err) {
            alert("Erro ao importar backup.");
        } finally {
            setLoading(false);
            e.target.value = null; 
        }
    };

    if (view === 'grid') {
        return (
            <Box sx={{ height: '100%', p: 0 }}>
                <PageHeader 
                    title="Apuração e Relatórios" 
                    subtitle="Visualize relatórios gráficos detalhados e exporte dados."
                    action={
                        <Button 
                            variant="outlined" 
                            startIcon={<UploadIcon />} 
                            onClick={() => fileInputRef.current.click()}
                            size="small"
                        >
                            Restaurar Backup (JSON)
                        </Button>
                    }
                />
                
                <QuestionnaireSelector 
                    mode="view"
                    onSelect={handleSelectQuestionnaire}
                />
                
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    accept=".json" 
                    onChange={handleFileChange}
                />
            </Box>
        );
    }

    if (loading && !reportData) return <Typography p={3}>Carregando...</Typography>;

    return (
        <Box>
            <Paper sx={{ p: 2, mb: 3, display: 'print:none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                
                <Box display="flex" alignItems="center" gap={3}>
                    <Button startIcon={<HomeIcon />} onClick={() => setView('grid')}>Voltar</Button>
                    
                    <ToggleButtonGroup
                        value={analysisMode}
                        exclusive
                        onChange={(e, newMode) => { if(newMode) setAnalysisMode(newMode); }}
                        size="small"
                    >
                        <ToggleButton value="report">
                            <ViewListIcon sx={{ mr: 1 }} />
                            Relatório Geral
                        </ToggleButton>
                        <ToggleButton value="crosstab">
                            <PivotIcon sx={{ mr: 1 }} />
                            Tabulação Cruzada
                        </ToggleButton>
                    </ToggleButtonGroup>
                </Box>

                {analysisMode === 'report' && (
                    <>
                        <Button 
                            variant="contained" 
                            startIcon={<ExportIcon />} 
                            endIcon={<MoreIcon />}
                            onClick={handleMenuClick}
                        >
                            Exportar / Ações
                        </Button>
                        <Menu anchorEl={anchorEl} open={openMenu} onClose={handleMenuClose}>
                            <MenuItem onClick={handlePrint}>
                                <ListItemIcon><PrintIcon fontSize="small" /></ListItemIcon>
                                <ListItemText>Imprimir / PDF</ListItemText>
                            </MenuItem>
                            <MenuItem onClick={handleExportDoc}>
                                <ListItemIcon><DocIcon fontSize="small" /></ListItemIcon>
                                <ListItemText>Relatório (DOC)</ListItemText>
                            </MenuItem>
                            <Divider />
                            <MenuItem onClick={handleExportCsvData}>
                                <ListItemIcon><CsvIcon fontSize="small" /></ListItemIcon>
                                <ListItemText>Dados Brutos (CSV)</ListItemText>
                            </MenuItem>
                            <MenuItem onClick={handleExportBackup}>
                                <ListItemIcon><BackupIcon fontSize="small" /></ListItemIcon>
                                <ListItemText>Backup Completo (JSON)</ListItemText>
                            </MenuItem>
                        </Menu>
                    </>
                )}
            </Paper>

            {reportData && (
                <Box id="report-area">
                    <Box sx={{ mb: 4, textAlign: 'center' }}>
                        <Typography variant="h4" gutterBottom>{reportData.questionnaire.name}</Typography>
                        
                        {/* PADRONIZAÇÃO: "Total de Entrevistas" */}
                        <Chip 
                            label={`Total de Entrevistas: ${reportData.total_interviews}`} 
                            color="primary" 
                            sx={{ fontSize: '1.1rem', py: 2 }} 
                        />
                    </Box>

                    {analysisMode === 'report' && (
                        <>
                            <AnalyticsFilter 
                                questions={reportData.questions} 
                                onApplyFilter={handleFilterChange}
                                activeFilter={activeFilter}
                            />
                            <Stack spacing={2}>
                                {reportData.questions.map((q) => <QuestionAnalysisCard key={q.id} question={q} />)}
                            </Stack>
                        </>
                    )}

                    {analysisMode === 'crosstab' && (
                        <CrosstabView 
                            questionnaireId={reportData.questionnaire.id}
                            questions={reportData.questions} 
                        />
                    )}
                </Box>
            )}
        </Box>
    );
}