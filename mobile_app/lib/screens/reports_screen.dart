import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:school_biometric_mobile/core/api_service.dart';
import 'package:intl/intl.dart';
import 'package:animate_do/animate_do.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

enum DatePreset { thisWeek, thisMonth, lastThreeMonths, custom }
enum GroupBy { entireSchool, byClass, byStream }

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  DatePreset _datePreset = DatePreset.thisWeek;
  GroupBy _groupBy = GroupBy.entireSchool;
  int? _selectedClassId;
  int? _selectedStreamId;
  DateTime? _customFrom;
  DateTime? _customTo;
  
  List<dynamic> _classes = [];
  List<dynamic> _streams = [];
  List<dynamic> _previewRecords = [];
  
  bool _loadingClasses = false;
  bool _loadingStreams = false;
  bool _loadingPreview = false;
  bool _exportingPdf = false;
  String? _error;

  late DateTime _from;
  late DateTime _to;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() {
      if (!_tabController.indexIsChanging) {
        _loadPreview();
      }
    });
    
    _applyPreset();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadClasses();
      _loadStreams();
      _loadPreview();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _applyPreset() {
    final now = DateTime.now();
    switch (_datePreset) {
      case DatePreset.thisWeek:
        _from = now.subtract(Duration(days: now.weekday - 1));
        _to = now;
        break;
      case DatePreset.thisMonth:
        _from = DateTime(now.year, now.month, 1);
        _to = now;
        break;
      case DatePreset.lastThreeMonths:
        final m = now.month - 2;
        _from = DateTime(now.year + (m <= 0 ? -1 : 0), m <= 0 ? m + 12 : m, 1);
        _to = now;
        break;
      case DatePreset.custom:
        _from = _customFrom ?? DateTime(now.year, now.month, 1);
        _to = _customTo ?? now;
        break;
    }
  }

  String get _currentUserType => _tabController.index == 0 ? 'student' : 'teacher';

  Future<void> _loadClasses() async {
    setState(() => _loadingClasses = true);
    try {
      final res = await ApiService.get('/api/v1/classes');
      if (res.statusCode == 200 && mounted) {
        setState(() => _classes = res.data is List ? res.data : []);
      }
    } catch (_) {}
    if (mounted) setState(() => _loadingClasses = false);
  }

  Future<void> _loadStreams() async {
    setState(() => _loadingStreams = true);
    try {
      final res = await ApiService.get('/api/v1/streams');
      if (res.statusCode == 200 && mounted) {
        setState(() => _streams = res.data is List ? res.data : []);
      }
    } catch (_) {}
    if (mounted) setState(() => _loadingStreams = false);
  }

  Future<void> _loadPreview() async {
    if (mounted) {
      setState(() {
        _loadingPreview = true;
        _error = null;
      });
    }
    _applyPreset();
    try {
      final params = <String, dynamic>{
        'date_from': DateFormat('yyyy-MM-dd').format(_from),
        'date_to': DateFormat('yyyy-MM-dd').format(_to),
        'user_type': _currentUserType,
        'page': 1,
        'page_size': 50,
      };
      if (_tabController.index == 0) { // Only for students
        if (_selectedClassId != null) params['class_id'] = _selectedClassId;
        if (_selectedStreamId != null) params['stream_id'] = _selectedStreamId;
      }
      
      final res = await ApiService.get('/api/v1/attendance', query: params);
      if (res.statusCode == 200 && mounted) {
        final data = res.data;
        final items = data is Map ? (data['items'] as List? ?? []) : (data is List ? data : []);
        setState(() => _previewRecords = items);
      }
    } catch (e) {
      if (mounted) setState(() => _error = "Failed to load records: $e");
    } finally {
      if (mounted) setState(() => _loadingPreview = false);
    }
  }

  Future<void> _exportPdf() async {
    setState(() {
      _exportingPdf = true;
      _error = null;
    });
    _applyPreset();
    try {
      final query = <String, String>{
        'date_from': DateFormat('yyyy-MM-dd').format(_from),
        'date_to': DateFormat('yyyy-MM-dd').format(_to),
        'user_type': _currentUserType,
      };
      if (_tabController.index == 0) {
        if (_selectedClassId != null) query['class_id'] = _selectedClassId.toString();
        if (_selectedStreamId != null) query['stream_id'] = _selectedStreamId.toString();
      }

      final res = await ApiService.dio.get<List<int>>(
        '/api/v1/reports/events',
        queryParameters: query,
        options: Options(responseType: ResponseType.bytes),
      );

      if (res.statusCode == 200 && res.data != null && mounted) {
        final dir = await getTemporaryDirectory();
        final typeLabel = _tabController.index == 0 ? 'student' : 'teacher';
        final file = File('${dir.path}/${typeLabel}_report_${DateTime.now().millisecondsSinceEpoch}.pdf');
        await file.writeAsBytes(res.data!);
        
        await Share.shareXFiles(
          [XFile(file.path)],
          subject: '${typeLabel.toUpperCase()} Attendance Report',
          text: 'Attendance report for ${DateFormat('yyyy-MM-dd').format(_from)} to ${DateFormat('yyyy-MM-dd').format(_to)}',
        );
      } else {
        throw 'Failed to generate PDF (Status: ${res.statusCode})';
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _exportingPdf = false);
    }
  }

  Future<void> _pickDateRange() async {
    final now = DateTime.now();
    final range = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: now,
      initialDateRange: _customFrom != null && _customTo != null 
          ? DateTimeRange(start: _customFrom!, end: _customTo!)
          : null,
      builder: (context, child) {
        return Theme(
          data: ThemeData.dark().copyWith(
            colorScheme: const ColorScheme.dark(
              primary: Color(0xFF3b82f6),
              onPrimary: Colors.white,
              surface: Color(0xFF0f172a),
              onSurface: Colors.white,
            ),
          ),
          child: child!,
        );
      },
    );

    if (range != null && mounted) {
      setState(() {
        _customFrom = range.start;
        _customTo = range.end;
        _datePreset = DatePreset.custom;
      });
      _loadPreview();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF020617),
      body: CustomScrollView(
        physics: const BouncingScrollPhysics(),
        slivers: [
          _buildAppBar(),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 20),
                  if (_error != null) _buildErrorBanner(),
                  _buildTabBar(),
                  const SizedBox(height: 24),
                  _buildDateSection(),
                  if (_tabController.index == 0) ...[
                    const SizedBox(height: 24),
                    _buildFilterSection(),
                  ],
                  const SizedBox(height: 32),
                  _buildExportButton(),
                  const SizedBox(height: 32),
                  _buildPreviewHeader(),
                  const SizedBox(height: 16),
                  _buildPreviewList(),
                  const SizedBox(height: 50),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAppBar() {
    return SliverAppBar(
      expandedHeight: 120,
      pinned: true,
      backgroundColor: const Color(0xFF020617),
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white),
        onPressed: () => Navigator.pop(context),
      ),
      flexibleSpace: FlexibleSpaceBar(
        titlePadding: const EdgeInsets.only(left: 56, bottom: 16),
        title: const Text(
          'Attendance Reports',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.white),
        ),
        background: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [const Color(0xFF3b82f6).withOpacity(0.15), Colors.transparent],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTabBar() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(16),
      ),
      child: TabBar(
        controller: _tabController,
        dividerColor: Colors.transparent,
        indicatorSize: TabBarIndicatorSize.tab,
        indicator: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          gradient: const LinearGradient(colors: [Color(0xFF3b82f6), Color(0xFF6366f1)]),
        ),
        labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
        unselectedLabelColor: Colors.white.withOpacity(0.4),
        tabs: const [Tab(text: 'Students'), Tab(text: 'Teachers')],
      ),
    );
  }

  Widget _buildDateSection() {
    return FadeInDown(
      child: _sectionCard(
        title: 'Time Period',
        icon: Icons.calendar_today_rounded,
        color: const Color(0xFF3b82f6),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _chip('This Week', DatePreset.thisWeek),
                _chip('This Month', DatePreset.thisMonth),
                _chip('Quarterly', DatePreset.lastThreeMonths),
                _chip('Custom', DatePreset.custom),
              ],
            ),
            if (_datePreset == DatePreset.custom) ...[
              const SizedBox(height: 16),
              GestureDetector(
                onTap: _pickDateRange,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.05),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.white.withOpacity(0.1)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.date_range_rounded, color: Color(0xFF3b82f6), size: 18),
                      const SizedBox(width: 12),
                      Text(
                        _customFrom != null 
                            ? '${DateFormat('MMM d').format(_from)} — ${DateFormat('MMM d, y').format(_to)}'
                            : 'Select Date Range',
                        style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w500),
                      ),
                      const Spacer(),
                      const Icon(Icons.edit_rounded, color: Colors.white24, size: 16),
                    ],
                  ),
                ),
              ),
            ] else ...[
              const SizedBox(height: 12),
              Text(
                'Showing: ${DateFormat('MMM d').format(_from)} — ${DateFormat('MMM d, y').format(_to)}',
                style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 12),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildFilterSection() {
    return FadeInDown(
      delay: const Duration(milliseconds: 100),
      child: _sectionCard(
        title: 'Filter By',
        icon: Icons.filter_list_rounded,
        color: const Color(0xFF10b981),
        child: Column(
          children: [
            Row(
              children: [
                _groupChip('All', GroupBy.entireSchool),
                const SizedBox(width: 8),
                _groupChip('Class', GroupBy.byClass),
                const SizedBox(width: 8),
                _groupChip('Stream', GroupBy.byStream),
              ],
            ),
            if (_groupBy != GroupBy.entireSchool) ...[
              const SizedBox(height: 16),
              _groupBy == GroupBy.byClass ? _buildClassDropdown() : _buildStreamDropdown(),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildPreviewHeader() {
    return Row(
      children: [
        const Text('Data Preview', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
        const Spacer(),
        if (_loadingPreview)
          const SizedBox(height: 14, width: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF3b82f6)))
        else
          Text('${_previewRecords.length} records', style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 12)),
      ],
    );
  }

  Widget _buildPreviewList() {
    if (_loadingPreview && _previewRecords.isEmpty) {
      return const Center(child: Padding(padding: EdgeInsets.all(40), child: CircularProgressIndicator()));
    }
    if (_previewRecords.isEmpty) {
      return Center(
        child: Container(
          padding: const EdgeInsets.all(40),
          child: Column(
            children: [
              Icon(Icons.inventory_2_outlined, color: Colors.white.withOpacity(0.1), size: 48),
              const SizedBox(height: 16),
              Text('No data for this period', style: TextStyle(color: Colors.white.withOpacity(0.3))),
            ],
          ),
        ),
      );
    }
    return Column(
      children: _previewRecords.take(20).map((r) => _buildRecordTile(r)).toList(),
    );
  }

  Widget _buildRecordTile(Map<String, dynamic> r) {
    final date = DateTime.tryParse(r['occurred_at'] ?? r['scanned_at'] ?? '');
    final isIN = r['event_type'] == 'IN';
    final name = r['student_name'] ?? r['teacher_name'] ?? 'User';
    final accent = isIN ? const Color(0xFF3b82f6) : Colors.orangeAccent;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.03),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withOpacity(0.06)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: accent.withOpacity(0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(isIN ? Icons.login_rounded : Icons.logout_rounded, color: accent, size: 20),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                const SizedBox(height: 2),
                Text(
                  _tabController.index == 0 
                      ? (r['class_name'] ?? 'No Class')
                      : (r['employee_id'] ?? 'Teacher'),
                  style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 12),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                date != null ? DateFormat('hh:mm a').format(date.toLocal()) : '--:--',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
              ),
              Text(
                date != null ? DateFormat('MMM d').format(date.toLocal()) : '',
                style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 11),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _sectionCard({required String title, required IconData icon, required Color color, required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.04),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: color.withOpacity(0.15), borderRadius: BorderRadius.circular(10)),
                child: Icon(icon, color: color, size: 18),
              ),
              const SizedBox(width: 12),
              Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
            ],
          ),
          const SizedBox(height: 20),
          child,
        ],
      ),
    );
  }

  Widget _chip(String label, DatePreset preset) {
    final active = _datePreset == preset;
    return GestureDetector(
      onTap: () {
        setState(() => _datePreset = preset);
        _loadPreview();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: active ? const Color(0xFF3b82f6) : Colors.white.withOpacity(0.05),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: active ? Colors.transparent : Colors.white.withOpacity(0.1)),
        ),
        child: Text(
          label,
          style: TextStyle(color: active ? Colors.white : Colors.white60, fontSize: 12, fontWeight: active ? FontWeight.bold : FontWeight.normal),
        ),
      ),
    );
  }

  Widget _groupChip(String label, GroupBy group) {
    final active = _groupBy == group;
    return GestureDetector(
      onTap: () {
        setState(() {
          _groupBy = group;
          if (group == GroupBy.entireSchool) {
            _selectedClassId = null;
            _selectedStreamId = null;
          }
        });
        _loadPreview();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: active ? const Color(0xFF10b981) : Colors.white.withOpacity(0.05),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: active ? Colors.transparent : Colors.white.withOpacity(0.1)),
        ),
        child: Text(
          label,
          style: TextStyle(color: active ? Colors.white : Colors.white60, fontSize: 12, fontWeight: active ? FontWeight.bold : FontWeight.normal),
        ),
      ),
    );
  }

  Widget _buildClassDropdown() {
    return _dropdownContainer(
      hint: 'Select Class',
      value: _selectedClassId,
      loading: _loadingClasses,
      items: _classes.map((c) => DropdownMenuItem<int>(value: c['id'], child: Text(c['name'] ?? 'Class'))).toList(),
      onChanged: (v) {
        setState(() => _selectedClassId = v);
        _loadPreview();
      },
    );
  }

  Widget _buildStreamDropdown() {
    return _dropdownContainer(
      hint: 'Select Stream',
      value: _selectedStreamId,
      loading: _loadingStreams,
      items: _streams.map((s) => DropdownMenuItem<int>(value: s['id'], child: Text(s['name'] ?? 'Stream'))).toList(),
      onChanged: (v) {
        setState(() => _selectedStreamId = v);
        _loadPreview();
      },
    );
  }

  Widget _dropdownContainer<T>({required String hint, T? value, required bool loading, required List<DropdownMenuItem<T>> items, required ValueChanged<T?> onChanged}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withOpacity(0.1)),
      ),
      child: DropdownButton<T>(
        value: value,
        hint: loading ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2)) : Text(hint, style: TextStyle(color: Colors.white.withOpacity(0.3), fontSize: 14)),
        isExpanded: true,
        underline: const SizedBox(),
        dropdownColor: const Color(0xFF1e293b),
        style: const TextStyle(color: Colors.white, fontSize: 14),
        items: items,
        onChanged: onChanged,
      ),
    );
  }

  Widget _buildExportButton() {
    return FadeInUp(
      delay: const Duration(milliseconds: 200),
      child: GestureDetector(
        onTap: _exportingPdf ? null : _exportPdf,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 20),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            gradient: const LinearGradient(colors: [Color(0xFF3b82f6), Color(0xFF6366f1)]),
            boxShadow: [
              BoxShadow(color: const Color(0xFF3b82f6).withOpacity(0.35), blurRadius: 20, offset: const Offset(0, 8)),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (_exportingPdf)
                const SizedBox(height: 24, width: 24, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              else
                const Icon(Icons.picture_as_pdf_rounded, color: Colors.white, size: 24),
              const SizedBox(width: 12),
              Text(
                _exportingPdf ? 'Generating PDF...' : 'Download PDF Report',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildErrorBanner() {
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.redAccent.withOpacity(0.1), borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.redAccent.withOpacity(0.2))),
      child: Row(
        children: [
          const Icon(Icons.error_outline_rounded, color: Colors.redAccent, size: 20),
          const SizedBox(width: 12),
          Expanded(child: Text(_error!, style: const TextStyle(color: Colors.redAccent, fontSize: 12))),
          IconButton(onPressed: () => setState(() => _error = null), icon: const Icon(Icons.close, color: Colors.redAccent, size: 18)),
        ],
      ),
    );
  }
}
