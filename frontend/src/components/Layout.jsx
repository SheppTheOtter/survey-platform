import React from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Divider,
  Avatar
} from "@mui/material";
import {
  Assignment as AssignmentIcon,
  Poll as PollIcon,
  BarChart as BarChartIcon,
  Dashboard as DashboardIcon
} from "@mui/icons-material";

const DRAWER_WIDTH = 260;

export default function Layout({ children, page, setPage }) {
  
  const menuItems = [
    { id: "questionnaires", label: "Questionários", icon: <AssignmentIcon /> },
    { id: "collection", label: "Coleta de Dados", icon: <PollIcon /> },
    { id: "analytics", label: "Apuração & Relatórios", icon: <BarChartIcon /> },
  ];

  return (
    <Box sx={{ display: "flex" }}>
      {/* APP BAR (Topo) */}
      <AppBar 
        position="fixed" 
        sx={{ 
          width: `calc(100% - ${DRAWER_WIDTH}px)`, 
          ml: `${DRAWER_WIDTH}px`,
          bgcolor: 'white',
          color: 'text.primary',
          boxShadow: 1
        }}
      >
        <Toolbar>
          <Typography variant="h6" noWrap component="div">
            {menuItems.find(m => m.id === page)?.label || "Dashboard"}
          </Typography>
        </Toolbar>
      </AppBar>

      {/* SIDEBAR (Lateral) */}
      <Drawer
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            bgcolor: '#1a2035', // Cor escura "Admin"
            color: 'white'
          },
        }}
        variant="permanent"
        anchor="left"
      >
        {/* LOGO AREA */}
        <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{ bgcolor: '#007fff' }} variant="rounded">
            <DashboardIcon />
          </Avatar>
          <Box>
            <Typography variant="subtitle1" fontWeight="bold">SurveyAdmin</Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>v1.0 Pro</Typography>
          </Box>
        </Box>
        
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

        {/* MENU */}
        <List sx={{ pt: 2 }}>
          {menuItems.map((item) => (
            <ListItem key={item.id} disablePadding>
              <ListItemButton
                selected={page === item.id}
                onClick={() => setPage(item.id)}
                sx={{
                  '&.Mui-selected': {
                    bgcolor: 'rgba(255,255,255,0.1)',
                    borderRight: '4px solid #007fff',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' }
                  },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                  py: 1.5
                }}
              >
                <ListItemIcon sx={{ color: page === item.id ? '#007fff' : 'rgba(255,255,255,0.7)' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Drawer>

      {/* CONTEÚDO PRINCIPAL */}
      <Box
        component="main"
        sx={{ flexGrow: 1, bgcolor: '#f4f6f8', minHeight: '100vh', p: 3 }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}