import React, { useEffect, useState } from 'react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './components/ui/table';
import { Input } from './components/ui/input';
import { Button } from './components/ui/button';

function OrderDashboard() {
  const [orders, setOrders] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 100;
  const [totalCount, setTotalCount] = useState(0);

  const fetchOrders = (pageNum) => {
    setLoading(true);
    fetch(`https://flask-backend-400816870138.europe-north1.run.app/orderdata?page=${pageNum}&page_size=${pageSize}`, { mode: 'cors' })
      .then(res => {
        if (!res.ok) throw new Error('Nätverksfel vid hämtning av data');
        return res.json();
      })
      .then(json => {
        setOrders(json.data);
        setTotalCount(json.total_count);
        setPage(json.page);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchOrders(page);
  }, []);

  const handleNextPage = () => {
    if (page < Math.ceil(totalCount / pageSize)) fetchOrders(page + 1);
  };

  const handlePrevPage = () => {
    if (page > 1) fetchOrders(page - 1);
  };

  const toggleExpand = (lineId) => {
    setExpanded(prev => ({ ...prev, [lineId]: !prev[lineId] }));
  };

  const isExpanded = (lineId) => expanded[lineId] === true;

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString('sv-SE') + ' ' + date.toLocaleTimeString('sv-SE');
  };

  const formatPrice = (value, currency) => {
    if (value === null || value === undefined) return '';
    return `${parseFloat(value).toFixed(2)} ${currency || ''}`;
  };

  const getStatusClass = (status) => {
    if (!status) return '';
    switch(status.toUpperCase()) {
      case 'SHIPPED': return 'text-green-500';
      case 'CANCELLED': return 'text-red-500';
      case 'PENDING': return 'text-amber-500';
      case 'PROCESSING': return 'text-blue-500';
      default: return '';
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-primary text-lg">Laddar orderdata...</div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-destructive text-lg">Fel: {error}</div>
    </div>
  );

  if (!orders || orders.length === 0) return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-muted-foreground text-lg">Inga ordrar på denna sida</div>
    </div>
  );

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="p-4">
      <div className="flex items-center justify-end mb-4">
        <div className="flex space-x-2">
          <Button onClick={handlePrevPage} disabled={page <= 1}>Föregående</Button>
          <Button onClick={handleNextPage} disabled={page >= totalPages}>Nästa</Button>
        </div>
      </div>

      <div className="border p-4 rounded">
        <header>
          <h2 className="text-lg font-bold">Senaste Ordrarna</h2>
          <p>
            Visar de {Math.min(orders.length, pageSize)} senaste ordrarna (sida {page} av {totalPages}). Totalt {totalCount} rader.
          </p>
        </header>
        <div className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Land</TableHead>
                <TableHead>Produkt</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Artikelnr</TableHead>
                <TableHead>Variant</TableHead>
                <TableHead className="text-right">Antal</TableHead>
                <TableHead className="text-right">Radpris</TableHead>
                <TableHead className="text-right">Totalpris</TableHead>
                <TableHead className="text-right">Moms %</TableHead>
                <TableHead>Line ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((row, idx) => {
                const rowKey = `row-${row.line_id}-${idx}`;
                const hasChildren = Array.isArray(row.children) && row.children.some(child => child.child_line_id);
                if (row.line_typename === 'BundleOrderLine') {
                  return (
                    <React.Fragment key={rowKey}>
                      <TableRow className="cursor-pointer" onClick={() => toggleExpand(row.line_id)}>
                        <TableCell>{row.order_number}</TableCell>
                        <TableCell className={getStatusClass(row.status)}>{row.status}</TableCell>
                        <TableCell>{formatDate(row.created_at)}</TableCell>
                        <TableCell>{row.country_name}</TableCell>
                        <TableCell>
                          <span className="text-primary mr-2 inline-flex transition-transform duration-200" style={{ transform: isExpanded(row.line_id) ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                            <ChevronDown size={18} />
                          </span>
                          {row.product_name}
                          {!hasChildren && <span className="text-muted-foreground text-sm italic ml-2">(inga child-lines)</span>}
                        </TableCell>
                        <TableCell>{row.line_typename}</TableCell>
                        <TableCell>{row.product_number}</TableCell>
                        <TableCell>{row.product_variant_name || '-'}</TableCell>
                        <TableCell className="text-right">{row.quantity}</TableCell>
                        <TableCell className="text-right font-medium">{formatPrice(row.line_value, row.line_currency)}</TableCell>
                        <TableCell className="text-right font-medium">{formatPrice(row.grand_total_value, row.grand_total_currency)}</TableCell>
                        <TableCell className="text-right">{row.tax_percent ? `${row.tax_percent}%` : ''}</TableCell>
                        <TableCell className="font-mono text-sm">{row.line_id}</TableCell>
                      </TableRow>
                      {isExpanded(row.line_id) && hasChildren && row.children.map((child, cIdx) => {
                        if (!child.child_line_id) return null;
                        const childKey = `child-${child.child_line_id}-${cIdx}`;
                        return (
                          <TableRow key={childKey} className="bg-muted/30 border-l-4 border-l-primary">
                            <TableCell></TableCell>
                            <TableCell></TableCell>
                            <TableCell></TableCell>
                            <TableCell></TableCell>
                            <TableCell className="pl-8">{child.child_product_name}</TableCell>
                            <TableCell>{child.child_line_typename}</TableCell>
                            <TableCell>{child.child_product_number}</TableCell>
                            <TableCell>{child.child_product_variant_name || '-'}</TableCell>
                            <TableCell className="text-right">{child.child_quantity}</TableCell>
                            <TableCell className="text-right font-medium">{formatPrice(child.child_line_value, child.child_line_currency)}</TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-right">{child.child_tax_percent ? `${child.child_tax_percent}%` : ''}</TableCell>
                            <TableCell className="font-mono text-sm">{child.child_line_id}</TableCell>
                          </TableRow>
                        );
                      })}
                    </React.Fragment>
                  );
                }
                return (
                  <TableRow key={rowKey}>
                    <TableCell>{row.order_number}</TableCell>
                    <TableCell className={getStatusClass(row.status)}>{row.status}</TableCell>
                    <TableCell>{formatDate(row.created_at)}</TableCell>
                    <TableCell>{row.country_name}</TableCell>
                    <TableCell>{row.product_name}</TableCell>
                    <TableCell>{row.line_typename}</TableCell>
                    <TableCell>{row.product_number}</TableCell>
                    <TableCell>{row.product_variant_name || '-'}</TableCell>
                    <TableCell className="text-right">{row.quantity}</TableCell>
                    <TableCell className="text-right font-medium">{formatPrice(row.line_value, row.line_currency)}</TableCell>
                    <TableCell className="text-right font-medium">{formatPrice(row.grand_total_value, row.grand_total_currency)}</TableCell>
                    <TableCell className="text-right">{row.tax_percent ? `${row.tax_percent}%` : ''}</TableCell>
                    <TableCell className="font-mono text-sm">{row.line_id}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="flex justify-end mt-4 space-x-2">
        <Button onClick={handlePrevPage} disabled={page <= 1}>Föregående</Button>
        <Button onClick={handleNextPage} disabled={page >= totalPages}>Nästa</Button>
      </div>
    </div>
  );
}

export default OrderDashboard;
 